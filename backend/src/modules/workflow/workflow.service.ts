import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateStatusDto } from './dto/create-status.dto';
import { CreateTransitionDto } from './dto/create-transition.dto';
import { ProjectRole } from '@prisma/client';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  /**
   * Returns all statuses for a project, ordered by position
   * @param projectId - Project UUID
   * @param userId - Requester must be a member
   */
  async getStatuses(projectId: string, userId: string) {
    await this.projectsService.assertRole(projectId, userId, Object.values(ProjectRole) as ProjectRole[]);
    return this.prisma.issueStatus.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
    });
  }

  /**
   * Creates a new custom status for a project
   * @param projectId - Project UUID
   * @param dto - Status details
   * @param userId - Must be OWNER or ADMIN
   */
  async createStatus(projectId: string, dto: CreateStatusDto, userId: string) {
    await this.projectsService.assertRole(projectId, userId, [ProjectRole.OWNER, ProjectRole.ADMIN]);

    return this.prisma.issueStatus.create({
      data: { projectId, ...dto },
    });
  }

  /**
   * Updates a status
   * @param statusId - Status UUID
   * @param dto - Fields to update
   * @param userId - Must be OWNER or ADMIN
   */
  async updateStatus(statusId: string, dto: Partial<CreateStatusDto>, userId: string) {
    const status = await this.prisma.issueStatus.findUnique({ where: { id: statusId } });
    if (!status) throw new NotFoundException('Status not found');

    await this.projectsService.assertRole(status.projectId, userId, [ProjectRole.OWNER, ProjectRole.ADMIN]);

    return this.prisma.issueStatus.update({ where: { id: statusId }, data: dto });
  }

  /**
   * Deletes a status (cannot delete if issues exist with this status)
   * @param statusId - Status UUID
   * @param userId - Must be OWNER or ADMIN
   */
  async deleteStatus(statusId: string, userId: string) {
    const status = await this.prisma.issueStatus.findUnique({ where: { id: statusId } });
    if (!status) throw new NotFoundException('Status not found');

    await this.projectsService.assertRole(status.projectId, userId, [ProjectRole.OWNER, ProjectRole.ADMIN]);

    const issueCount = await this.prisma.issue.count({
      where: { statusId, deletedAt: null },
    });
    if (issueCount > 0) {
      throw new BadRequestException(`Cannot delete status with ${issueCount} active issues`);
    }

    return this.prisma.issueStatus.delete({ where: { id: statusId } });
  }

  /**
   * Returns all workflow transitions for a project
   * @param projectId - Project UUID
   * @param userId - Must be a member
   */
  async getTransitions(projectId: string, userId: string) {
    await this.projectsService.assertRole(projectId, userId, Object.values(ProjectRole) as ProjectRole[]);

    return this.prisma.workflowTransition.findMany({
      where: { workflow: { projectId } },
      include: { fromStatus: true, toStatus: true },
    });
  }

  /**
   * Validates whether a status transition is allowed
   * @param projectId - Project UUID
   * @param fromStatusId - Current status
   * @param toStatusId - Target status
   */
  async canTransition(projectId: string, fromStatusId: string, toStatusId: string): Promise<boolean> {
    // Same status is always allowed (no-op)
    if (fromStatusId === toStatusId) return true;

    // Check if a default workflow exists for this project
    const workflow = await this.prisma.workflow.findFirst({
      where: { projectId, isDefault: true },
    });

    // If no workflow is defined, we allow all transitions (fallback for legacy projects)
    if (!workflow) return true;

    const transition = await this.prisma.workflowTransition.findFirst({
      where: {
        workflowId: workflow.id,
        fromStatusId,
        toStatusId,
      },
    });
    return transition !== null;
  }

  /**
   * Adds a transition to the default workflow
   * @param projectId - Project UUID
   * @param dto - fromStatusId, toStatusId, name
   * @param userId - Must be OWNER or ADMIN
   */
  async createTransition(projectId: string, dto: CreateTransitionDto, userId: string) {
    await this.projectsService.assertRole(projectId, userId, [ProjectRole.OWNER, ProjectRole.ADMIN]);

    const workflow = await this.prisma.workflow.findFirst({
      where: { projectId, isDefault: true },
    });
    if (!workflow) throw new NotFoundException('Default workflow not found');

    return this.prisma.workflowTransition.create({
      data: { workflowId: workflow.id, ...dto },
      include: { fromStatus: true, toStatus: true },
    });
  }

  /**
   * Deletes a workflow transition
   * @param transitionId - Transition UUID
   * @param userId - Must be OWNER or ADMIN
   */
  async deleteTransition(transitionId: string, userId: string) {
    const transition = await this.prisma.workflowTransition.findUnique({
      where: { id: transitionId },
      include: { workflow: true },
    });
    if (!transition) throw new NotFoundException('Transition not found');

    await this.projectsService.assertRole(
      transition.workflow.projectId, userId, [ProjectRole.OWNER, ProjectRole.ADMIN],
    );

    return this.prisma.workflowTransition.delete({ where: { id: transitionId } });
  }
}
