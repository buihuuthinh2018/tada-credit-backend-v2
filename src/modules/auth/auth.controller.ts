import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto';
import { LoginDto, RefreshTokenDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public, CurrentUser } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/interfaces';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  @Post('register')
  @Public()
  async register(@Body() dto: CreateUserDto) {
    const result = await this.authService.register(dto);
    
    await this.auditService.log({
      userId: result.user.id,
      action: 'USER_REGISTERED',
      targetType: 'user',
      targetId: result.user.id,
    });

    return result;
  }

  @Post('login')
  @Public()
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    
    await this.auditService.log({
      userId: result.user.id,
      action: 'USER_LOGIN',
      targetType: 'user',
      targetId: result.user.id,
    });

    return result;
  }

  @Post('refresh')
  @Public()
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AuthenticatedUser) {
    await this.auditService.log({
      userId: user.id,
      action: 'USER_LOGOUT',
      targetType: 'user',
      targetId: user.id,
    });

    return { message: 'Logged out successfully' };
  }
}
