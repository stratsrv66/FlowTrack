import {
  Injectable, NotFoundException, ForbiddenException, Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Adds a comment to an issue
   * @param issueId - Issue UUID
   * @param dto - Body, optional parentId and mentionedUserIds
   * @param authorId - Authenticated user's ID
   */
  async create(issueId: string, dto: CreateCommentDto, authorId: string) {
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, deletedAt: null },
    });
    if (!issue) throw new NotFoundException('Issue not found');

    // Verify user is a member of the project
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: issue.projectId, userId: authorId } },
    });
    if (!member) throw new ForbiddenException('You are not a member of this project');

    const comment = await this.prisma.comment.create({
      data: {
        body: dto.body,
        issueId,
        authorId,
        parentId: dto.parentId,
        mentions: dto.mentionedUserIds?.length
          ? { connect: dto.mentionedUserIds.map((id) => ({ id })) }
          : undefined,
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        mentions: { select: { id: true, displayName: true } },
        replies: {
          where: { deletedAt: null },
          include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
    });

    this.events.emit('comment.added', {
      comment,
      issue,
      actorId: authorId,
      mentionedUserIds: dto.mentionedUserIds ?? [],
    });

    return comment;
  }

  /**
   * Updates a comment — only the author can edit
   * @param commentId - Comment UUID
   * @param body - New content
   * @param userId - Must be the original author
   */
  async update(commentId: string, body: string, userId: string) {
    const comment = await this.findRaw(commentId);
    if (comment.authorId !== userId) throw new ForbiddenException('You can only edit your own comments');

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { body, isEdited: true },
      include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
  }

  /**
   * Soft-deletes a comment — author or project admin can delete
   * @param commentId - Comment UUID
   * @param userId - Requester's ID
   */
  async remove(commentId: string, userId: string) {
    const comment = await this.findRaw(commentId);

    const issue = await this.prisma.issue.findUnique({ where: { id: comment.issueId } });
    if (!issue) throw new NotFoundException('Issue not found');

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: issue.projectId, userId } },
    });

    const isAuthor = comment.authorId === userId;
    const isAdmin = member && ['OWNER', 'ADMIN'].includes(member.role);

    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException('Insufficient permissions to delete this comment');
    }

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Comment deleted' };
  }

  private async findRaw(commentId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }
}
