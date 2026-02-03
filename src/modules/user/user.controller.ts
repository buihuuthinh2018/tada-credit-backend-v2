import { Controller, Get, Post, Put, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/interfaces';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly auditService: AuditService,
  ) {}

  @Get('me')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.findById(user.id);
  }

  @Put('me')
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserDto,
  ) {
    // Don't allow status update via this endpoint
    const { status, ...updateData } = dto;
    const result = await this.userService.update(user.id, updateData);
    
    await this.auditService.log({
      userId: user.id,
      action: 'USER_PROFILE_UPDATED',
      targetType: 'user',
      targetId: user.id,
    });

    return result;
  }

  @Get('me/referrals')
  getMyReferrals(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.userService.getReferrals(user.id, page, limit);
  }
}

@Controller('admin/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminUserController {
  constructor(
    private readonly userService: UserService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @Permissions('user:read')
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.userService.findAll(page, limit);
  }

  @Get(':id')
  @Permissions('user:read')
  findOne(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Put(':id')
  @Permissions('user:update')
  async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const result = await this.userService.update(id, dto);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'ADMIN_USER_UPDATED',
      targetType: 'user',
      targetId: id,
      metadata: { changes: dto },
    });

    return result;
  }

  @Post(':id/roles/:roleId')
  @Permissions('user:manage-roles')
  async assignRole(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') userId: string,
    @Param('roleId') roleId: string,
  ) {
    const result = await this.userService.assignRole(userId, roleId);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'USER_ROLE_ASSIGNED',
      targetType: 'user',
      targetId: userId,
      metadata: { roleId },
    });

    return result;
  }

  @Patch(':id/roles/:roleId/remove')
  @Permissions('user:manage-roles')
  async removeRole(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') userId: string,
    @Param('roleId') roleId: string,
  ) {
    const result = await this.userService.removeRole(userId, roleId);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'USER_ROLE_REMOVED',
      targetType: 'user',
      targetId: userId,
      metadata: { roleId },
    });

    return result;
  }

  @Patch(':id/verify')
  @Permissions('user:verify')
  async verifyUser(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') userId: string,
  ) {
    const result = await this.userService.verifyUser(userId);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'USER_VERIFIED',
      targetType: 'user',
      targetId: userId,
    });

    return result;
  }

  @Patch(':id/suspend')
  @Permissions('user:suspend')
  async suspendUser(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') userId: string,
  ) {
    const result = await this.userService.suspendUser(userId);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'USER_SUSPENDED',
      targetType: 'user',
      targetId: userId,
    });

    return result;
  }

  @Patch(':id/activate')
  @Permissions('user:activate')
  async activateUser(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') userId: string,
  ) {
    const result = await this.userService.activateUser(userId);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'USER_ACTIVATED',
      targetType: 'user',
      targetId: userId,
    });

    return result;
  }

  @Get(':id/referrals')
  @Permissions('user:read')
  getReferrals(
    @Param('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.userService.getReferrals(userId, page, limit);
  }
}
