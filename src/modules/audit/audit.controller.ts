import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions } from '../../common/decorators';

@ApiTags('Audit')
@ApiBearerAuth('JWT-auth')
@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions('audit:read')
  @ApiOperation({ summary: 'Get all audit logs' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Returns paginated list of audit logs' })
  findAll(
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.auditService.findAll(pageNum, limitNum);
  }

  @Get('by-user')
  @Permissions('audit:read')
  @ApiOperation({ summary: 'Get audit logs by user ID' })
  @ApiQuery({ name: 'userId', required: true, description: 'User ID to filter by' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Returns paginated audit logs for specific user' })
  findByUser(
    @Query('userId') userId: string,
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.auditService.findByUser(userId, pageNum, limitNum);
  }

  @Get('by-target')
  @Permissions('audit:read')
  @ApiOperation({ summary: 'Get audit logs by target' })
  @ApiQuery({ name: 'targetType', required: true, description: 'Target type (e.g., user, contract, wallet)' })
  @ApiQuery({ name: 'targetId', required: true, description: 'Target ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Returns paginated audit logs for specific target' })
  findByTarget(
    @Query('targetType') targetType: string,
    @Query('targetId') targetId: string,
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.auditService.findByTarget(targetType, targetId, pageNum, limitNum);
  }

  @Get('by-action')
  @Permissions('audit:read')
  @ApiOperation({ summary: 'Get audit logs by action type' })
  @ApiQuery({ name: 'action', required: true, description: 'Action type to filter by' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Returns paginated audit logs for specific action' })
  findByAction(
    @Query('action') action: string,
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.auditService.findByAction(action, pageNum, limitNum);
  }
}
