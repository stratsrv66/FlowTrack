import {
  Injectable, NotFoundException, ForbiddenException, ConflictException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { hashPassword, comparePassword } from '../../common/utils/hash.util';
import { UserRole } from '@prisma/client';

// Fields returned in public user profile (no passwordHash)
const USER_SELECT = {
  id: true, email: true, username: true, displayName: true, bio: true,
  avatarUrl: true, role: true, isActive: true, lastSeenAt: true, createdAt: true,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all non-deleted, active users (admin only)
   * @returns List of user profiles
   */
  async findAll() {
    return this.prisma.user.findMany({
      where: { deletedAt: null, isActive: true },
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Finds a user by ID
   * @param id - User UUID
   * @returns User profile
   */
  async findById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Updates the authenticated user's profile.
   * If username is changed, ensures it is still unique.
   * @param id - User UUID
   * @param dto - Fields to update (displayName, username, bio, avatarUrl)
   */
  async updateProfile(id: string, dto: UpdateUserDto) {
    await this.findById(id);

    if (dto.username) {
      const taken = await this.prisma.user.findFirst({
        where: { username: dto.username, NOT: { id } },
        select: { id: true },
      });
      if (taken) throw new ConflictException('Username is already taken');
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: USER_SELECT,
    });
  }

  /**
   * Changes the authenticated user's password
   * @param id - User UUID
   * @param dto - Current and new password
   */
  async changePassword(id: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const isValid = await comparePassword(dto.currentPassword, user.passwordHash);
    if (!isValid) throw new ForbiddenException('Current password is incorrect');

    const passwordHash = await hashPassword(dto.newPassword);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });

    // Revoke all refresh tokens on password change
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Password changed successfully' };
  }

  /**
   * Soft-deletes a user (admin only)
   * @param id - User UUID
   * @param requesterId - Admin's user ID
   */
  async remove(id: string, requesterId: string) {
    if (id === requesterId) throw new ForbiddenException('Cannot delete your own account');
    const user = await this.findById(id);

    return this.prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  /**
   * Sets a user's system-level role (admin only)
   * @param id - User UUID
   * @param role - New UserRole
   */
  async setRole(id: string, role: UserRole) {
    await this.findById(id);
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: USER_SELECT,
    });
  }
}
