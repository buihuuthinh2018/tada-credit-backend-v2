import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PermissionService } from './permission.service';
import { CreatePermissionDto, UpdatePermissionDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/interfaces';

@ApiTags('Permissions')
@ApiBearerAuth('JWT-auth')
@Controller('admin/permissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Permissions('permission:create')
  @ApiOperation({ summary: 'Create a new permission' })
  @ApiResponse({ status: 201, description: 'Permission created successfully' })
  @ApiResponse({ status: 409, description: 'Permission code already exists' })
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
  @ApiOperation({ summary: 'Get all permissions' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({ status: 200, description: 'Returns paginated list of permissions' })
  findAll(
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 50,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.permissionService.findAll(pageNum, limitNum);
  }

  @Get(':id')
  @Permissions('permission:read')
  @ApiOperation({ summary: 'Get permission by ID' })
  @ApiParam({ name: 'id', description: 'Permission ID' })
  @ApiResponse({ status: 200, description: 'Returns permission details with assigned roles' })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  findOne(@Param('id') id: string) {
    return this.permissionService.findById(id);
  }

  @Put(':id')
  @Permissions('permission:update')
  @ApiOperation({ summary: 'Update permission' })
  @ApiParam({ name: 'id', description: 'Permission ID' })
  @ApiResponse({ status: 200, description: 'Permission updated successfully' })
  @ApiResponse({ status: 404, description: 'Permission not found' })
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
  @ApiOperation({ summary: 'Delete permission' })
  @ApiParam({ name: 'id', description: 'Permission ID' })
  @ApiResponse({ status: 200, description: 'Permission deleted successfully' })
  @ApiResponse({ status: 404, description: 'Permission not found' })
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
