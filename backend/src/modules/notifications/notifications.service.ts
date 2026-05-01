import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { CursorPaginationDto, buildCursorPaginatedResult } from '../../common/utils/pagination.util';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // Event Listeners
  // ==========================================

  /** Notifies assignee when an issue is assigned */
  @OnEvent('issue.updated')
  async onIssueAssigned(payload: { issue: any; previousIssue: any; actorId: string }) {
    const { issue, previousIssue, actorId } = payload;

    if (issue.assigneeId && issue.assigneeId !== previousIssue.assigneeId && issue.assigneeId !== actorId) {
      await this.create({
        type: NotificationType.ISSUE_ASSIGNED,
        title: 'Issue assigned to you',
        body: `You were assigned to "${issue.title}"`,
        userId: issue.assigneeId,
        issueId: issue.id,
        actorId,
      });
    }
  }

  /** Notifies mentioned users when a comment is added */
  @OnEvent('comment.added')
  async onMentions(payload: { comment: any; issue: any; actorId: string; mentionedUserIds: string[] }) {
    const { comment, issue, actorId, mentionedUserIds } = payload;

    for (const userId of mentionedUserIds) {
      if (userId === actorId) continue;
      await this.create({
        type: NotificationType.MENTION,
        title: 'You were mentioned',
        body: `You were mentioned in a comment on "${issue.title}"`,
        userId,
        issueId: issue.id,
        actorId,
        metadata: { commentId: comment.id },
      });
    }
  }

  /** Notifies users mentioned in an issue description (on create or description update) */
  @OnEvent('issue.mentioned')
  async onIssueMentions(payload: { issue: any; actorId: string; mentionedUserIds: string[] }) {
    const { issue, actorId, mentionedUserIds } = payload;

    for (const userId of mentionedUserIds) {
      if (userId === actorId) continue;
      await this.create({
        type: NotificationType.MENTION,
        title: 'You were mentioned',
        body: `You were mentioned in the description of "${issue.title}"`,
        userId,
        issueId: issue.id,
        actorId,
        metadata: { source: 'issue_description' },
      });
    }
  }

  // ==========================================
  // Query / Mutations
  // ==========================================

  /**
   * Returns paginated notifications for the authenticated user
   * @param userId - Recipient's ID
   * @param onlyUnread - When true, returns only unread notifications
   * @param pagination - cursor + limit
   */
  async findAll(userId: string, onlyUnread: boolean, pagination: CursorPaginationDto) {
    const { cursor, limit } = pagination;

    const items = await this.prisma.notification.findMany({
      where: { userId, ...(onlyUnread && { isRead: false }) },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: 'desc' },
    });

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return { ...buildCursorPaginatedResult(items, limit), unreadCount };
  }

  /**
   * Marks a single notification as read
   * @param notificationId - Notification UUID
   * @param userId - Must own the notification
   */
  async markRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Marks all notifications as read for a user
   * @param userId - Recipient's ID
   */
  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /** Internal: creates a notification record */
  async create(data: {
    type: NotificationType;
    title: string;
    body: string;
    userId: string;
    issueId?: string;
    actorId?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      return await this.prisma.notification.create({ data });
    } catch (err) {
      this.logger.error(`Failed to create notification: ${(err as Error).message}`);
    }
  }
}
