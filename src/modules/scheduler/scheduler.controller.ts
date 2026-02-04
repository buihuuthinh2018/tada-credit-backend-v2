import { Controller, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/interfaces';

@ApiTags('Admin - Scheduler')
@ApiBearerAuth('JWT-auth')
@Controller('admin/scheduler')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SchedulerController {
  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly auditService: AuditService,
  ) {}

  @Post('run-monthly-snapshot')
  @Permissions('commission:create')
  @ApiOperation({ summary: 'Manually run monthly snapshot for a specific period' })
  @ApiQuery({ name: 'year', required: true, type: Number, example: 2026 })
  @ApiQuery({ name: 'month', required: true, type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Snapshot run completed' })
  async runManualSnapshot(
    @CurrentUser() admin: AuthenticatedUser,
    @Query('year') year: string | number,
    @Query('month') month: string | number,
  ) {
    const yearNum = typeof year === 'string' ? parseInt(year, 10) : year;
    const monthNum = typeof month === 'string' ? parseInt(month, 10) : month;

    const result = await this.schedulerService.runManualSnapshot(yearNum, monthNum);

    await this.auditService.log({
      userId: admin.id,
      action: 'SCHEDULER_MANUAL_SNAPSHOT',
      targetType: 'scheduler',
      targetId: undefined,
      metadata: { year: yearNum, month: monthNum, result },
    });

    return result;
  }
}
