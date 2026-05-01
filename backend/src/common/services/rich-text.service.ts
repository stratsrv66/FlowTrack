import { Injectable } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { PrismaService } from '../../prisma/prisma.service';

/** Allowed tags for rich-text descriptions (bold, color, sizes, separators, etc.) */
const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'div', 'span',
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

/** Inline style properties allowed (color, background, font-size, alignment) */
const ALLOWED_STYLES: Record<string, Record<string, RegExp[]>> = {
  '*': {
    color: [/^#(0x)?[0-9a-fA-F]+$/, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/, /^[a-zA-Z]+$/],
    'background-color': [/^#(0x)?[0-9a-fA-F]+$/, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/, /^[a-zA-Z]+$/],
    'font-size': [/^\d+(?:\.\d+)?(?:px|em|rem|%|pt)$/],
    'text-align': [/^(?:left|right|center|justify)$/],
    'font-weight': [/^(?:normal|bold|\d{3})$/],
  },
};

/** Matches @username tokens — letters, digits, underscores, hyphens (3-50 chars) */
const MENTION_REGEX = /(^|[^\w])@([a-zA-Z0-9_-]{2,50})\b/g;

@Injectable()
export class RichTextService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sanitizes user-supplied HTML by stripping tags/attributes outside the allowlist.
   * Prevents stored XSS while keeping formatting (bold, color, sizes, separators, links).
   * @param html - Raw HTML string from the client
   * @returns Safe HTML string (or empty string if input is falsy)
   */
  sanitize(html?: string | null): string {
    if (!html) return '';
    return sanitizeHtml(html, {
      allowedTags: ALLOWED_TAGS,
      allowedAttributes: {
        '*': ['style', 'class'],
        a: ['href', 'target', 'rel'],
        span: ['style', 'class', 'data-user-id', 'data-mention'],
      },
      allowedStyles: ALLOWED_STYLES,
      allowedSchemes: ['http', 'https', 'mailto'],
      transformTags: {
        // Force external links to open safely
        a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
      },
    });
  }

  /**
   * Extracts unique @usernames from a piece of text (raw or HTML).
   * @param content - Text or HTML potentially containing @username tokens
   * @returns Array of unique usernames (without the leading @)
   */
  extractUsernames(content?: string | null): string[] {
    if (!content) return [];
    const usernames = new Set<string>();
    let match: RegExpExecArray | null;
    const re = new RegExp(MENTION_REGEX.source, 'g');
    while ((match = re.exec(content)) !== null) {
      usernames.add(match[2]);
    }
    return Array.from(usernames);
  }

  /**
   * Resolves @usernames to existing active users.
   * @param usernames - Usernames extracted from content
   * @returns Map of username -> { id, displayName }
   */
  async resolveMentions(usernames: string[]) {
    if (!usernames.length) return new Map<string, { id: string; displayName: string }>();
    const users = await this.prisma.user.findMany({
      where: {
        username: { in: usernames },
        deletedAt: null,
        isActive: true,
      },
      select: { id: true, username: true, displayName: true },
    });
    return new Map(users.map((u) => [u.username, { id: u.id, displayName: u.displayName }]));
  }

  /**
   * Replaces @username tokens in HTML with highlighted spans the frontend can style.
   * Only known users are wrapped — unknown @tokens are left as plain text.
   * @param html - Sanitized HTML
   * @param mentionMap - Map of username -> { id, displayName }
   * @returns HTML with mentions wrapped in <span class="mention" data-user-id="...">@username</span>
   */
  highlightMentions(
    html: string,
    mentionMap: Map<string, { id: string; displayName: string }>,
  ): string {
    if (!html || mentionMap.size === 0) return html;
    return html.replace(MENTION_REGEX, (full, prefix: string, username: string) => {
      const user = mentionMap.get(username);
      if (!user) return full;
      return `${prefix}<span class="mention" data-user-id="${user.id}" data-mention="${username}">@${username}</span>`;
    });
  }

  /**
   * Full pipeline: sanitize HTML, find mentions, highlight known users.
   * @param html - Raw HTML from the client
   * @returns { html, mentionedUserIds } — safe HTML with highlighted mentions and the IDs
   */
  async processRichText(html?: string | null): Promise<{ html: string; mentionedUserIds: string[] }> {
    const safe = this.sanitize(html);
    if (!safe) return { html: '', mentionedUserIds: [] };

    const usernames = this.extractUsernames(safe);
    const mentionMap = await this.resolveMentions(usernames);
    const highlighted = this.highlightMentions(safe, mentionMap);
    const mentionedUserIds = Array.from(mentionMap.values()).map((u) => u.id);

    return { html: highlighted, mentionedUserIds };
  }
}
