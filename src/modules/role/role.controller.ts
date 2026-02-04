import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { CreateRoleDto, UpdateRoleDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/interfaces';

@ApiTags('Roles')
@ApiBearerAuth('JWT-auth')
@Controller('admin/roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RoleController {
  constructor(
    private readonly roleService: RoleService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Permissions('role:create')
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Role code already exists' })
  async create(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateRoleDto,
  ) {
    const result = await this.roleService.create(dto);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'ROLE_CREATED',
      targetType: 'role',
      targetId: result.id,
      metadata: { code: result.code },
    });

    return result;
  }

  @Get()
  @Permissions('role:read')
  @ApiOperation({ summary: 'Get all roles' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Returns paginated list of roles' })
  findAll(
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.roleService.findAll(pageNum, limitNum);
  }

  @Get(':id')
  @Permissions('role:read')
  @ApiOperation({ summary: 'Get role by ID' })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({ status: 200, description: 'Returns role details' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  findOne(@Param('id') id: string) {
    return this.roleService.findById(id);
  }

  @Put(':id')
  @Permissions('role:update')
  @ApiOperation({ summary: 'Update role' })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot modify system role' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const result = await this.roleService.update(id, dto);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'ROLE_UPDATED',
      targetType: 'role',
      targetId: id,
      metadata: { changes: dto },
    });

    return result;
  }

  @Delete(':id')
  @Permissions('role:delete')
  @ApiOperation({ summary: 'Delete role' })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({ status: 200, description: 'Role deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete system role or role with assigned users' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async delete(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const result = await this.roleService.delete(id);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'ROLE_DELETED',
      targetType: 'role',
      targetId: id,
    });

    return result;
  }

  @Post(':id/permissions/:permissionId')
  @Permissions('role:manage-permissions')
  @ApiOperation({ summary: 'Assign permission to role' })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiParam({ name: 'permissionId', description: 'Permission ID to assign' })
  @ApiResponse({ status: 200, description: 'Permission assigned successfully' })
  @ApiResponse({ status: 404, description: 'Role or permission not found' })
  @ApiResponse({ status: 409, description: 'Permission already assigned' })
  async assignPermission(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') roleId: string,
    @Param('permissionId') permissionId: string,
  ) {
    const result = await this.roleService.assignPermission(roleId, permissionId);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'ROLE_PERMISSION_ASSIGNED',
      targetType: 'role',
      targetId: roleId,
      metadata: { permissionId },
    });

    return result;
  }

  @Delete(':id/permissions/:permissionId')
  @Permissions('role:manage-permissions')
  @ApiOperation({ summary: 'Remove permission from role' })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiParam({ name: 'permissionId', description: 'Permission ID to remove' })
  @ApiResponse({ status: 200, description: 'Permission removed successfully' })
  @ApiResponse({ status: 404, description: 'Permission not assigned to this role' })
  async removePermission(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') roleId: string,
    @Param('permissionId') permissionId: string,
  ) {
    const result = await this.roleService.removePermission(roleId, permissionId);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'ROLE_PERMISSION_REMOVED',
      targetType: 'role',
      targetId: roleId,
      metadata: { permissionId },
    });

    return result;
  }

  @Get(':id/permissions')
  @Permissions('role:read')
  @ApiOperation({ summary: 'Get all permissions assigned to a role' })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({ status: 200, description: 'Returns list of permissions' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  getRolePermissions(@Param('id') roleId: string) {
    return this.roleService.getRolePermissions(roleId);
  }
}
