import { Controller, Get, Post, Put, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/interfaces';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly auditService: AuditService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Returns current user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.findById(user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Get current user referrals' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Returns list of referrals' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMyReferrals(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.userService.getReferrals(user.id, pageNum, limitNum);
  }
}

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminUserController {
  constructor(
    private readonly userService: UserService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @Permissions('user:read')
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by user ID, name, email, or phone' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires user:read permission' })
  findAll(
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
    @Query('search') search?: string,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.userService.findAll(pageNum, limitNum, search);
  }

  @Get(':id')
  @Permissions('user:read')
  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Returns user details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires user:read permission' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Put(':id')
  @Permissions('user:update')
  @ApiOperation({ summary: 'Update user (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires user:update permission' })
  @ApiResponse({ status: 404, description: 'User not found' })
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
  @ApiOperation({ summary: 'Assign role to user (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiParam({ name: 'roleId', description: 'Role ID to assign' })
  @ApiResponse({ status: 200, description: 'Role assigned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires user:manage-roles permission' })
  @ApiResponse({ status: 404, description: 'User or role not found' })
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
  @ApiOperation({ summary: 'Remove role from user (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiParam({ name: 'roleId', description: 'Role ID to remove' })
  @ApiResponse({ status: 200, description: 'Role removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires user:manage-roles permission' })
  @ApiResponse({ status: 404, description: 'User or role not found' })
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
  @ApiOperation({ summary: 'Verify user (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User verified successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires user:verify permission' })
  @ApiResponse({ status: 404, description: 'User not found' })
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
  @ApiOperation({ summary: 'Suspend user (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User suspended successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires user:suspend permission' })
  @ApiResponse({ status: 404, description: 'User not found' })
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
  @ApiOperation({ summary: 'Activate user (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires user:activate permission' })
  @ApiResponse({ status: 404, description: 'User not found' })
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
  @ApiOperation({ summary: 'Get user referrals (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Returns list of user referrals' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires user:read permission' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getReferrals(
    @Param('id') userId: string,
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.userService.getReferrals(userId, pageNum, limitNum);
  }
}
