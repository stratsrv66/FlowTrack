import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../../prisma/prisma.service';
import * as hashUtil from '../../../common/utils/hash.util';

// Mock utilities
jest.mock('../../../common/utils/hash.util');

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockJwt = {
  signAsync: jest.fn().mockResolvedValue('mock-token'),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    const map: Record<string, any> = {
      'jwt.accessSecret': 'access-secret',
      'jwt.accessExpiresIn': '15m',
      'jwt.refreshSecret': 'refresh-secret',
      'jwt.refreshExpiresIn': '7d',
    };
    return map[key];
  }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      username: 'testuser',
      displayName: 'Test User',
      password: 'Password1!',
    };

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: '1', email: registerDto.email });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should create user and return tokens on success', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      (hashUtil.hashPassword as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123', email: registerDto.email, role: 'MEMBER',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ token: 'refresh-123' });

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'Password1!' };

    it('should throw UnauthorizedException if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: '1', isActive: true, passwordHash: 'hash',
      });
      (hashUtil.comparePassword as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens and user on successful login', async () => {
      const user = {
        id: 'user-123', email: loginDto.email, role: 'MEMBER', isActive: true,
        username: 'test', displayName: 'Test', avatarUrl: null, passwordHash: 'hash',
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      (hashUtil.comparePassword as jest.Mock).mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue(user);
      mockPrisma.refreshToken.create.mockResolvedValue({ token: 'refresh-123' });

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.id).toBe('user-123');
    });
  });
});
