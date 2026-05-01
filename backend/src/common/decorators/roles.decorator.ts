import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Declares which UserRoles are allowed to access a route */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
