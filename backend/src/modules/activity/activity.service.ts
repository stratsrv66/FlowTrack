import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityAction } from '@prisma/client';
import { CursorPaginationDto, buildCursorPaginatedResult } from '../../common/utils/pagination.util';

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // Event Listeners — CQRS-lite write side
  // ==========================================

  /** Records activity when an issue is created */
  @OnEvent('issue.created')
  async onIssueCreated(payload: { issue: any; actorId: string; projectId: string }) {
    await this.log({
      action: ActivityAction.CREATED,
      entityType: 'issue',
      entityId: payload.issue.id,
      actorId: payload.actorId,
      projectId: payload.projectId,
      issueId: payload.issue.id,
      metadata: { key: payload.issue.key, title: payload.issue.title },
    });
  }

  /** Diffs field changes and records granular activity entries */
  @OnEvent('issue.updated')
  async onIssueUpdated(payload: { issue: any; previousIssue: any; actorId: string; projectId: string }) {
    const { issue, previousIssue, actorId, projectId } = payload;
    const entries: any[] = [];

    if (issue.statusId !== previousIssue.statusId) {
      entries.push({
        action: ActivityAction.STATUS_CHANGED,
        metadata: { from: previousIssue.statusId, to: issue.statusId },
      });
    }
    if (issue.assigneeId !== previousIssue.assigneeId) {
      entries.push({
        action: issue.assigneeId ? ActivityAction.ASSIGNED : ActivityAction.UNASSIGNED,
        metadata: { from: previousIssue.assigneeId, to: issue.assigneeId },
      });
    }
    if (issue.priority !== previousIssue.priority) {
      entries.push({
        action: ActivityAction.PRIORITY_CHANGED,
        metadata: { from: previousIssue.priority, to: issue.priority },
      });
    }
    if (issue.title !== previousIssue.title) {
      entries.push({
        action: ActivityAction.TITLE_CHANGED,
        metadata: { from: previousIssue.title, to: issue.title },
      });
    }

    for (const entry of entries) {
      await this.log({
        action: entry.action,
        entityType: 'issue',
        entityId: issue.id,
        actorId,
        projectId,
        issueId: issue.id,
        metadata: entry.metadata,
      });
    }
  }

  /** Records activity when an issue is deleted */
  @OnEvent('issue.deleted')
  async onIssueDeleted(payload: { issueId: string; actorId: string; projectId: string }) {
    await this.log({
      action: ActivityAction.DELETED,
      entityType: 'issue',
      entityId: payload.issueId,
      actorId: payload.actorId,
      projectId: payload.projectId,
      issueId: payload.issueId,
    });
  }

  /** Records activity when a comment is added */
  @OnEvent('comment.added')
  async onCommentAdded(payload: { comment: any; issue: any; actorId: string }) {
    await this.log({
      action: ActivityAction.COMMENTED,
      entityType: 'comment',
      entityId: payload.comment.id,
      actorId: payload.actorId,
      projectId: payload.issue.projectId,
      issueId: payload.issue.id,
      metadata: { commentId: payload.comment.id },
    });
  }

  // ==========================================
  // Query side
  // ==========================================

  /**
   * Returns paginated activity for a specific issue
   * @param issueId - Issue UUID
   * @param pagination - cursor + limit
   */
  async getIssueActivity(issueId: string, pagination: CursorPaginationDto) {
    const { cursor, limit } = pagination;

    const items = await this.prisma.activityLog.findMany({
      where: { issueId },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    return buildCursorPaginatedResult(items, limit);
  }

  /**
   * Returns paginated activity for a project
   * @param projectId - Project UUID
   * @param pagination - cursor + limit
   */
  async getProjectActivity(projectId: string, pagination: CursorPaginationDto) {
    const { cursor, limit } = pagination;

    const items = await this.prisma.activityLog.findMany({
      where: { projectId },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    return buildCursorPaginatedResult(items, limit);
  }

  /** Internal helper to persist an activity log entry */
  private async log(data: {
    action: ActivityAction;
    entityType: string;
    entityId: string;
    actorId: string;
    projectId?: string;
    issueId?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      await this.prisma.activityLog.create({ data });
    } catch (err) {
      // Activity logging must never break the main flow
      this.logger.error(`Failed to log activity: ${(err as Error).message}`);
    }
  }
}
