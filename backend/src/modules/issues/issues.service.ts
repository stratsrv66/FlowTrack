import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { WorkflowService } from '../workflow/workflow.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { FilterIssuesDto } from './dto/filter-issues.dto';
import { buildCursorPaginatedResult } from '../../common/utils/pagination.util';
import { ProjectRole } from '@prisma/client';
import { RichTextService } from '../../common/services/rich-text.service';

const ISSUE_INCLUDE = {
  status: true,
  assignee: { select: { id: true, displayName: true, avatarUrl: true } },
  reporter: { select: { id: true, displayName: true, avatarUrl: true } },
  labels: { include: { label: true } },
  mentions: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  _count: { select: { comments: true, children: true } },
} as const;

@Injectable()
export class IssuesService {
  private readonly logger = new Logger(IssuesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly workflowService: WorkflowService,
    private readonly events: EventEmitter2,
    private readonly richText: RichTextService,
  ) {}

  /**
   * Creates a new issue and generates the project-scoped key (e.g., FT-42)
   * @param projectId - Project UUID
   * @param dto - Issue data
   * @param reporterId - User creating the issue
   */
  async create(projectId: string, dto: CreateIssueDto, reporterId: string) {
    await this.assertProjectMember(projectId, reporterId);

    // Verify the status belongs to this project
    const status = await this.prisma.issueStatus.findFirst({
      where: { id: dto.statusId, projectId },
    });
    if (!status) throw new BadRequestException('Status does not belong to this project');

    // Generate sequential key: count all issues (including deleted) + 1
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const issueCount = await this.prisma.issue.count({ where: { projectId } });
    const key = `${project.key}-${issueCount + 1}`;

    // Sanitize HTML and highlight @username mentions
    const { html, mentionedUserIds } = await this.richText.processRichText(dto.description);

    const issue = await this.prisma.issue.create({
      data: {
        key,
        title: dto.title,
        description: html || null,
        type: dto.type,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        projectId,
        statusId: dto.statusId,
        assigneeId: dto.assigneeId,
        reporterId,
        parentId: dto.parentId,
        labels: dto.labelIds?.length
          ? { createMany: { data: dto.labelIds.map((labelId) => ({ labelId })) } }
          : undefined,
        mentions: mentionedUserIds.length
          ? { connect: mentionedUserIds.map((id) => ({ id })) }
          : undefined,
      },
      include: ISSUE_INCLUDE,
    });

    this.events.emit('issue.created', {
      issue,
      actorId: reporterId,
      projectId,
    });

    if (mentionedUserIds.length) {
      this.events.emit('issue.mentioned', {
        issue,
        actorId: reporterId,
        mentionedUserIds,
      });
    }

    return issue;
  }

  /**
   * Returns paginated issues for a project with filters
   * @param projectId - Project UUID
   * @param filters - Search, status, priority, assignee + pagination
   * @param userId - Requester's ID
   */
  async findAll(projectId: string, filters: FilterIssuesDto, userId: string) {
    await this.assertProjectMember(projectId, userId);

    const { cursor, limit, statusId, priority, type, assigneeId, search, dueDate } = filters;

    const where: any = {
      projectId,
      deletedAt: null,
      ...(statusId && { statusId }),
      ...(priority && { priority }),
      ...(type && { type }),
      ...(assigneeId && { assigneeId }),
      ...(dueDate && {
        dueDate: {
          gte: new Date(`${dueDate}T00:00:00.000Z`),
          lte: new Date(`${dueDate}T23:59:59.999Z`),
        },
      }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { key: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const issues = await this.prisma.issue.findMany({
      where,
      take: limit + 1, // fetch one extra to detect hasMore
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      include: ISSUE_INCLUDE,
    });

    return buildCursorPaginatedResult(issues, limit);
  }

  /**
   * Returns a single issue with full detail
   * @param issueId - Issue UUID
   * @param userId - Requester's ID
   */
  async findOne(issueId: string, userId: string) {
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, deletedAt: null },
      include: {
        ...ISSUE_INCLUDE,
        project: { select: { id: true, name: true, key: true } },
        parent: { select: { id: true, key: true, title: true } },
        children: { where: { deletedAt: null }, select: { id: true, key: true, title: true, status: true } },
        comments: {
          where: { deletedAt: null, parentId: null },
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, displayName: true, avatarUrl: true } },
            replies: {
              where: { deletedAt: null },
              include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
            },
          },
        },
      },
    });

    if (!issue) throw new NotFoundException('Issue not found');
    await this.assertProjectMember(issue.projectId, userId);

    return issue;
  }

  /**
   * Updates an issue, validates workflow transitions, emits events
   * @param issueId - Issue UUID
   * @param dto - Fields to update
   * @param userId - Requester's ID
   */
  async update(issueId: string, dto: UpdateIssueDto, userId: string) {
    const existing = await this.findRaw(issueId);
    await this.assertProjectMember(existing.projectId, userId);

    // Validate status transition
    if (dto.statusId && dto.statusId !== existing.statusId) {
      const allowed = await this.workflowService.canTransition(
        existing.projectId, existing.statusId, dto.statusId,
      );
      if (!allowed) throw new BadRequestException('This status transition is not allowed by the workflow');
    }

    const { labelIds, description, ...issueData } = dto;

    // Process rich text only when description is being changed
    let descriptionUpdate: { description: string | null } | undefined;
    let mentionedUserIds: string[] = [];
    let previousMentionIds: string[] = [];
    if (description !== undefined) {
      const processed = await this.richText.processRichText(description);
      descriptionUpdate = { description: processed.html || null };
      mentionedUserIds = processed.mentionedUserIds;
      // Snapshot previous mentions BEFORE the update to detect newly-added ones
      const before = await this.prisma.issue.findUnique({
        where: { id: issueId },
        select: { mentions: { select: { id: true } } },
      });
      previousMentionIds = before?.mentions.map((m) => m.id) ?? [];
    }

    const updated = await this.prisma.issue.update({
      where: { id: issueId },
      data: {
        ...issueData,
        ...(descriptionUpdate ?? {}),
        dueDate: issueData.dueDate ? new Date(issueData.dueDate) : undefined,
        // Replace all labels when provided
        ...(labelIds !== undefined && {
          labels: {
            deleteMany: {},
            createMany: { data: labelIds.map((labelId) => ({ labelId })) },
          },
        }),
        // Replace mentions when description changes
        ...(descriptionUpdate && {
          mentions: {
            set: mentionedUserIds.map((id) => ({ id })),
          },
        }),
      },
      include: ISSUE_INCLUDE,
    });

    this.events.emit('issue.updated', {
      issue: updated,
      previousIssue: existing,
      actorId: userId,
      projectId: existing.projectId,
    });

    // Notify only newly-mentioned users (not those already mentioned previously)
    if (descriptionUpdate && mentionedUserIds.length) {
      const previousSet = new Set(previousMentionIds);
      const newlyMentioned = mentionedUserIds.filter((id) => !previousSet.has(id));
      if (newlyMentioned.length) {
        this.events.emit('issue.mentioned', {
          issue: updated,
          actorId: userId,
          mentionedUserIds: newlyMentioned,
        });
      }
    }

    return updated;
  }

  /**
   * Soft-deletes an issue
   * @param issueId - Issue UUID
   * @param userId - Requester's ID
   */
  async remove(issueId: string, userId: string) {
    const issue = await this.findRaw(issueId);
    await this.assertProjectMember(issue.projectId, userId);

    await this.prisma.issue.update({
      where: { id: issueId },
      data: { deletedAt: new Date() },
    });

    this.events.emit('issue.deleted', { issueId, actorId: userId, projectId: issue.projectId });
    return { message: 'Issue deleted' };
  }

  /** Internal — finds issue without visibility check */
  private async findRaw(issueId: string) {
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, deletedAt: null },
    });
    if (!issue) throw new NotFoundException('Issue not found');
    return issue;
  }

  /** Throws ForbiddenException if user is not a project member */
  private async assertProjectMember(projectId: string, userId: string) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) throw new ForbiddenException('You are not a member of this project');
  }
}
