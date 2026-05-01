import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { hashPassword, comparePassword } from '../../common/utils/hash.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Registers a new user
   * @param dto - Registration payload (email, username, displayName, password)
   * @returns Access and refresh tokens
   */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) {
      throw new ConflictException(
        existing.email === dto.email ? 'Email already in use' : 'Username already taken',
      );
    }

    const passwordHash = await hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        displayName: dto.displayName,
        passwordHash,
      },
    });

    this.logger.log(`New user registered: ${user.email}`);
    return this.generateTokenPair(user.id, user.email, user.role);
  }

  /**
   * Authenticates a user
   * @param dto - Login payload (email, password)
   * @returns Access and refresh tokens + user profile
   */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await comparePassword(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last seen
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    const tokens = await this.generateTokenPair(user.id, user.email, user.role);
    return {
      ...tokens,
      user: {
        id: user.id, email: user.email, username: user.username,
        displayName: user.displayName, avatarUrl: user.avatarUrl, role: user.role,
      },
    };
  }

  /**
   * Rotates the refresh token
   * @param userId - ID of the user requesting token refresh
   * @param oldToken - The refresh token being rotated
   * @returns New access and refresh tokens
   */
  async refresh(userId: string, oldToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: oldToken },
    });

    if (!stored || stored.userId !== userId || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke old token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new UnauthorizedException('User not found');

    return this.generateTokenPair(user.id, user.email, user.role);
  }

  /**
   * Revokes a refresh token (logout)
   * @param token - The refresh token to revoke
   */
  async logout(token: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Issues an access+refresh token pair and stores the refresh token */
  private async generateTokenPair(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
      }),
      this.generateRefreshToken(userId),
    ]);

    return { accessToken, refreshToken };
  }

  /** Creates and persists a new refresh token */
  private async generateRefreshToken(userId: string): Promise<string> {
    const token = uuid();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({ data: { token, userId, expiresAt } });
    return token;
  }
}
