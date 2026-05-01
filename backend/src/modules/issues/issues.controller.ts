import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
} from '@nestjs/common';
import { IssuesService } from './issues.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { FilterIssuesDto } from './dto/filter-issues.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('projects/:projectId/issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  /**
   * POST /projects/:projectId/issues
   * @body CreateIssueDto
   * Creates a new issue
   */
  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateIssueDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.issuesService.create(projectId, dto, userId);
  }

  /**
   * GET /projects/:projectId/issues
   * @query FilterIssuesDto
   * Returns paginated issues with optional filters
   */
  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query() filters: FilterIssuesDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.issuesService.findAll(projectId, filters, userId);
  }

  /**
   * GET /projects/:projectId/issues/:issueId
   * Returns a single issue with full detail
   */
  @Get(':issueId')
  findOne(
    @Param('issueId') issueId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.issuesService.findOne(issueId, userId);
  }

  /**
   * PATCH /projects/:projectId/issues/:issueId
   * @body UpdateIssueDto
   * Updates an issue
   */
  @Patch(':issueId')
  update(
    @Param('issueId') issueId: string,
    @Body() dto: UpdateIssueDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.issuesService.update(issueId, dto, userId);
  }

  /**
   * DELETE /projects/:projectId/issues/:issueId
   * Soft-deletes an issue
   */
  @Delete(':issueId')
  remove(
    @Param('issueId') issueId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.issuesService.remove(issueId, userId);
  }
}
