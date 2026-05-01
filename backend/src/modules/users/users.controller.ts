import {
  Controller, Get, Patch, Delete, Body, Param, UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';

@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /users
   * Lists all users — admin only
   */
  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  /**
   * GET /users/me
   * Returns current user's profile
   */
  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.usersService.findById(user.id);
  }

  /**
   * GET /users/:id
   * Returns a user's public profile
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  /**
   * PATCH /users/me
   * @body UpdateUserDto
   * Updates authenticated user's profile
   */
  @Patch('me')
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  /**
   * PATCH /users/me/password
   * @body ChangePasswordDto
   * Changes the authenticated user's password
   */
  @Patch('me/password')
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(userId, dto);
  }

  /**
   * DELETE /users/:id
   * Soft-deletes a user — admin only
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(
    @Param('id') id: string,
    @CurrentUser('id') requesterId: string,
  ) {
    return this.usersService.remove(id, requesterId);
  }
}
