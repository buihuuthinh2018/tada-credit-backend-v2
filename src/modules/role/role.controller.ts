import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto, UpdateRoleDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/interfaces';

@Controller('admin/roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RoleController {
  constructor(
    private readonly roleService: RoleService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Permissions('role:create')
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
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.roleService.findAll(page, limit);
  }

  @Get(':id')
  @Permissions('role:read')
  findOne(@Param('id') id: string) {
    return this.roleService.findById(id);
  }

  @Put(':id')
  @Permissions('role:update')
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
  getRolePermissions(@Param('id') roleId: string) {
    return this.roleService.getRolePermissions(roleId);
  }
}
