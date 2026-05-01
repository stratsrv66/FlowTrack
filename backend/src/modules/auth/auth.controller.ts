import {
  Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Get,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/register
   * @body RegisterDto
   * @returns { accessToken, refreshToken }
   */
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /auth/login
   * @body LoginDto
   * @returns { accessToken, refreshToken, user }
   */
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /auth/refresh
   * @body RefreshTokenDto
   * @returns { accessToken, refreshToken }
   */
  @Public()
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(
    @CurrentUser('id') userId: string,
    @Body() dto: RefreshTokenDto,
  ) {
    return this.authService.refresh(userId, dto.refreshToken);
  }

  /**
   * POST /auth/logout
   * @body RefreshTokenDto
   */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  /**
   * GET /auth/me
   * @returns Current user profile
   */
  @Get('me')
  me(@CurrentUser() user: any) {
    return user;
  }
}
