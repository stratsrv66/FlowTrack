import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('projects')
@UseGuards(RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  /**
   * POST /projects
   * @body CreateProjectDto
   * Creates a new project
   */
  @Post()
  create(
    @Body() dto: CreateProjectDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.projectsService.create(dto, userId);
  }

  /**
   * GET /projects
   * Lists all projects the user is a member of
   */
  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.projectsService.findAll(userId);
  }

  /**
   * GET /projects/:id
   * Returns a single project with members and statuses
   */
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.projectsService.findOne(id, userId);
  }

  /**
   * PATCH /projects/:id
   * @body UpdateProjectDto
   * Updates project — OWNER/ADMIN only
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.projectsService.update(id, dto, userId);
  }

  /**
   * DELETE /projects/:id
   * Soft-deletes project — OWNER only
   */
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.projectsService.remove(id, userId);
  }

  /**
   * POST /projects/:id/members
   * @body AddMemberDto
   * Adds a member — OWNER/ADMIN only
   */
  @Post(':id/members')
  addMember(
    @Param('id') projectId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.projectsService.addMember(projectId, dto, userId);
  }

  /**
   * DELETE /projects/:id/members/:memberId
   * Removes a member — OWNER/ADMIN only
   */
  @Delete(':id/members/:memberId')
  removeMember(
    @Param('id') projectId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.projectsService.removeMember(projectId, memberId, userId);
  }
}
