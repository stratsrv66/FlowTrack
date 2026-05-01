import {
  Controller, Get, Post, Patch, Delete, Body, Param,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { CreateStatusDto } from './dto/create-status.dto';
import { CreateTransitionDto } from './dto/create-transition.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('projects/:projectId/workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  /** GET /projects/:projectId/workflow/statuses */
  @Get('statuses')
  getStatuses(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.workflowService.getStatuses(projectId, userId);
  }

  /** POST /projects/:projectId/workflow/statuses */
  @Post('statuses')
  createStatus(
    @Param('projectId') projectId: string,
    @Body() dto: CreateStatusDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.workflowService.createStatus(projectId, dto, userId);
  }

  /** PATCH /projects/:projectId/workflow/statuses/:statusId */
  @Patch('statuses/:statusId')
  updateStatus(
    @Param('statusId') statusId: string,
    @Body() dto: Partial<CreateStatusDto>,
    @CurrentUser('id') userId: string,
  ) {
    return this.workflowService.updateStatus(statusId, dto, userId);
  }

  /** DELETE /projects/:projectId/workflow/statuses/:statusId */
  @Delete('statuses/:statusId')
  deleteStatus(
    @Param('statusId') statusId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.workflowService.deleteStatus(statusId, userId);
  }

  /** GET /projects/:projectId/workflow/transitions */
  @Get('transitions')
  getTransitions(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.workflowService.getTransitions(projectId, userId);
  }

  /** POST /projects/:projectId/workflow/transitions */
  @Post('transitions')
  createTransition(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTransitionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.workflowService.createTransition(projectId, dto, userId);
  }

  /** DELETE /projects/:projectId/workflow/transitions/:transitionId */
  @Delete('transitions/:transitionId')
  deleteTransition(
    @Param('transitionId') transitionId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.workflowService.deleteTransition(transitionId, userId);
  }
}
