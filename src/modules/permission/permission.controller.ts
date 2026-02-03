import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { CreatePermissionDto, UpdatePermissionDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/interfaces';

@Controller('admin/permissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Permissions('permission:create')
  async create(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreatePermissionDto,
  ) {
    const result = await this.permissionService.create(dto);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'PERMISSION_CREATED',
      targetType: 'permission',
      targetId: result.id,
      metadata: { code: result.code },
    });

    return result;
  }

  @Get()
  @Permissions('permission:read')
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.permissionService.findAll(page, limit);
  }

  @Get(':id')
  @Permissions('permission:read')
  findOne(@Param('id') id: string) {
    return this.permissionService.findById(id);
  }

  @Put(':id')
  @Permissions('permission:update')
  async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePermissionDto,
  ) {
    const result = await this.permissionService.update(id, dto);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'PERMISSION_UPDATED',
      targetType: 'permission',
      targetId: id,
      metadata: { changes: dto },
    });

    return result;
  }

  @Delete(':id')
  @Permissions('permission:delete')
  async delete(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const result = await this.permissionService.delete(id);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'PERMISSION_DELETED',
      targetType: 'permission',
      targetId: id,
    });

    return result;
  }
}
