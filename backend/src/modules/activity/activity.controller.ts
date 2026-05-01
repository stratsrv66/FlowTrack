import { Controller, Get, Param, Query } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { CursorPaginationDto } from '../../common/utils/pagination.util';

@Controller()
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  /** GET /issues/:issueId/activity */
  @Get('issues/:issueId/activity')
  getIssueActivity(
    @Param('issueId') issueId: string,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.activityService.getIssueActivity(issueId, pagination);
  }

  /** GET /projects/:projectId/activity */
  @Get('projects/:projectId/activity')
  getProjectActivity(
    @Param('projectId') projectId: string,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.activityService.getProjectActivity(projectId, pagination);
  }
}
