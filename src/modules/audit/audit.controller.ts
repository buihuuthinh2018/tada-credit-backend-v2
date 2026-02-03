import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions } from '../../common/decorators';

@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions('audit:read')
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.auditService.findAll(page, limit);
  }

  @Get('by-user')
  @Permissions('audit:read')
  findByUser(
    @Query('userId') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.auditService.findByUser(userId, page, limit);
  }

  @Get('by-target')
  @Permissions('audit:read')
  findByTarget(
    @Query('targetType') targetType: string,
    @Query('targetId') targetId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.auditService.findByTarget(targetType, targetId, page, limit);
  }

  @Get('by-action')
  @Permissions('audit:read')
  findByAction(
    @Query('action') action: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.auditService.findByAction(action, page, limit);
  }
}
