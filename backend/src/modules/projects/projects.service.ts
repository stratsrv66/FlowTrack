import {
  Injectable, NotFoundException, ForbiddenException, ConflictException, Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { ProjectRole } from '@prisma/client';
import { RichTextService } from '../../common/services/rich-text.service';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly richText: RichTextService,
  ) {}

  /**
   * Creates a new project and adds the creator as OWNER
   * @param dto - Project details
   * @param creatorId - ID of the creating user
   */
  async create(dto: CreateProjectDto, creatorId: string) {
    const exists = await this.prisma.project.findUnique({ where: { key: dto.key } });
    if (exists) throw new ConflictException(`Project key "${dto.key}" is already taken`);

    const project = await this.prisma.project.create({
      data: {
        ...dto,
        description: this.richText.sanitize(dto.description) || null,
        members: {
          create: { userId: creatorId, role: ProjectRole.OWNER },
        },
      },
      include: { members: { include: { user: true } } },
    });

    // Seed default statuses and workflow for the project
    await this.initializeProjectWorkflow(project.id);

    this.events.emit('project.created', { projectId: project.id, actorId: creatorId });
    return project;
  }

  /**
   * Returns all projects the user is a member of
   * @param userId - Requester's ID
   */
  async findAll(userId: string) {
    return this.prisma.project.findMany({
      where: {
        deletedAt: null,
        members: { some: { userId } },
      },
      include: {
        _count: { select: { issues: true, members: true } },
        members: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } },
          },
          take: 5,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Finds a project by ID, validates membership
   * @param id - Project UUID
   * @param userId - Requester's ID
   */
  async findOne(id: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        members: { include: { user: { select: { id: true, displayName: true, avatarUrl: true, email: true } } } },
        statuses: { orderBy: { position: 'asc' } },
        labels: true,
      },
    });

    if (!project) throw new NotFoundException('Project not found');
    this.assertMember(project, userId);
    return project;
  }

  /**
   * Updates a project
   * @param id - Project UUID
   * @param dto - Fields to update
   * @param userId - Requester's ID (must be OWNER or ADMIN)
   */
  async update(id: string, dto: UpdateProjectDto, userId: string) {
    await this.assertRole(id, userId, [ProjectRole.OWNER, ProjectRole.ADMIN]);

    const data: any = { ...dto };
    if (dto.description !== undefined) {
      data.description = this.richText.sanitize(dto.description) || null;
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data,
    });

    this.events.emit('project.updated', { projectId: id, actorId: userId });
    return updated;
  }

  /**
   * Soft-deletes a project (OWNER only)
   * @param id - Project UUID
   * @param userId - Requester's ID
   */
  async remove(id: string, userId: string) {
    await this.assertRole(id, userId, [ProjectRole.OWNER]);

    return this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Adds a member to a project
   * @param projectId - Project UUID
   * @param dto - User ID and role
   * @param requesterId - Must be OWNER or ADMIN
   */
  async addMember(projectId: string, dto: AddMemberDto, requesterId: string) {
    await this.assertRole(projectId, requesterId, [ProjectRole.OWNER, ProjectRole.ADMIN]);

    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: dto.userId } },
    });
    if (existing) throw new ConflictException('User is already a member');

    return this.prisma.projectMember.create({
      data: { projectId, userId: dto.userId, role: dto.role },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });
  }

  /**
   * Removes a member from a project
   * @param projectId - Project UUID
   * @param memberId - User ID to remove
   * @param requesterId - Must be OWNER or ADMIN
   */
  async removeMember(projectId: string, memberId: string, requesterId: string) {
    await this.assertRole(projectId, requesterId, [ProjectRole.OWNER, ProjectRole.ADMIN]);

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: memberId } },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === ProjectRole.OWNER) {
      throw new ForbiddenException('Cannot remove the project owner');
    }

    return this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId: memberId } },
    });
  }

  /** Initializes the standard set of statuses and a default workflow for the project */
  private async initializeProjectWorkflow(projectId: string) {
    // 1. Create Default Statuses
    const statuses = await Promise.all([
      this.prisma.issueStatus.create({ data: { projectId, name: 'To Do', color: '#6B7280', position: 0, isDefault: true } }),
      this.prisma.issueStatus.create({ data: { projectId, name: 'In Progress', color: '#3B82F6', position: 1 } }),
      this.prisma.issueStatus.create({ data: { projectId, name: 'In Review', color: '#F59E0B', position: 2 } }),
      this.prisma.issueStatus.create({ data: { projectId, name: 'Done', color: '#10B981', position: 3, isFinal: true } }),
      this.prisma.issueStatus.create({ data: { projectId, name: 'Cancelled', color: '#EF4444', position: 4, isFinal: true } }),
    ]);

    const statusMap = statuses.reduce((acc, s) => ({ ...acc, [s.name]: s.id }), {} as Record<string, string>);

    // 2. Create Default Workflow
    const workflow = await this.prisma.workflow.create({
      data: {
        projectId,
        name: 'Default Workflow',
        isDefault: true,
      },
    });

    // 3. Create Default Transitions
    await this.prisma.workflowTransition.createMany({
      data: [
        { workflowId: workflow.id, fromStatusId: statusMap['To Do'], toStatusId: statusMap['In Progress'], name: 'Start Progress' },
        { workflowId: workflow.id, fromStatusId: statusMap['In Progress'], toStatusId: statusMap['In Review'], name: 'Submit Review' },
        { workflowId: workflow.id, fromStatusId: statusMap['In Review'], toStatusId: statusMap['Done'], name: 'Approve' },
        { workflowId: workflow.id, fromStatusId: statusMap['In Review'], toStatusId: statusMap['In Progress'], name: 'Request Changes' },
        { workflowId: workflow.id, fromStatusId: statusMap['In Progress'], toStatusId: statusMap['Done'], name: 'Complete' },
        { workflowId: workflow.id, fromStatusId: statusMap['To Do'], toStatusId: statusMap['Cancelled'], name: 'Cancel' },
        { workflowId: workflow.id, fromStatusId: statusMap['In Progress'], toStatusId: statusMap['Cancelled'], name: 'Cancel' },
      ],
    });
  }

  /** Throws ForbiddenException if user is not in the given roles */
  async assertRole(projectId: string, userId: string, roles: ProjectRole[]) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member || !roles.includes(member.role)) {
      throw new ForbiddenException('Insufficient project permissions');
    }
    return member;
  }

  /** Throws ForbiddenException if user is not a project member */
  private assertMember(project: any, userId: string) {
    const isMember = project.members?.some((m: any) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('You are not a member of this project');
  }
}
