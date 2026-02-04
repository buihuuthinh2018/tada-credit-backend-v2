import { Controller, Get, Put, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SystemConfigService } from './system-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/interfaces';
import { UpdateSystemConfigDto, UpdateSnapshotDayDto } from './dto';

@ApiTags('Admin - System Config')
@ApiBearerAuth('JWT-auth')
@Controller('admin/system-config')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SystemConfigController {
  constructor(
    private readonly systemConfigService: SystemConfigService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @Permissions('system:read')
  @ApiOperation({ summary: 'Get all system configurations' })
  @ApiResponse({ status: 200, description: 'Returns all system configurations' })
  getAllConfigs() {
    return this.systemConfigService.getAllConfigs();
  }

  @Get(':key')
  @Permissions('system:read')
  @ApiOperation({ summary: 'Get system configuration by key' })
  @ApiParam({ name: 'key', description: 'Configuration key' })
  @ApiResponse({ status: 200, description: 'Returns configuration value' })
  getConfig(@Param('key') key: string) {
    return this.systemConfigService.getConfig(key);
  }

  @Put(':key')
  @Permissions('system:update')
  @ApiOperation({ summary: 'Update system configuration' })
  @ApiParam({ name: 'key', description: 'Configuration key' })
  @ApiResponse({ status: 200, description: 'Configuration updated successfully' })
  async updateConfig(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: UpdateSystemConfigDto,
  ) {
    const result = await this.systemConfigService.setConfig(key, dto.value);

    await this.auditService.log({
      userId: admin.id,
      action: 'SYSTEM_CONFIG_UPDATED',
      targetType: 'system_config',
      targetId: key,
      metadata: { key, value: dto.value },
    });

    return result;
  }

  @Delete(':key')
  @Permissions('system:delete')
  @ApiOperation({ summary: 'Delete system configuration' })
  @ApiParam({ name: 'key', description: 'Configuration key' })
  @ApiResponse({ status: 200, description: 'Configuration deleted successfully' })
  async deleteConfig(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('key') key: string,
  ) {
    const result = await this.systemConfigService.deleteConfig(key);

    await this.auditService.log({
      userId: admin.id,
      action: 'SYSTEM_CONFIG_DELETED',
      targetType: 'system_config',
      targetId: key,
      metadata: { key },
    });

    return result;
  }

  // Specific config endpoints
  @Get('commission/snapshot-day')
  @Permissions('system:read')
  @ApiOperation({ summary: 'Get commission snapshot day' })
  @ApiResponse({ status: 200, description: 'Returns snapshot day (1-28)' })
  async getSnapshotDay() {
    const day = await this.systemConfigService.getSnapshotDay();
    return { day };
  }

  @Put('commission/snapshot-day')
  @Permissions('system:update')
  @ApiOperation({ summary: 'Set commission snapshot day' })
  @ApiResponse({ status: 200, description: 'Snapshot day updated successfully' })
  async setSnapshotDay(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: UpdateSnapshotDayDto,
  ) {
    const result = await this.systemConfigService.setSnapshotDay(dto.day);

    await this.auditService.log({
      userId: admin.id,
      action: 'SNAPSHOT_DAY_UPDATED',
      targetType: 'system_config',
      targetId: 'commission_snapshot_day',
      metadata: { day: dto.day },
    });

    return result;
  }

  @Get('commission/kpi-enabled')
  @Permissions('system:read')
  @ApiOperation({ summary: 'Get KPI evaluation enabled status' })
  @ApiResponse({ status: 200, description: 'Returns enabled status' })
  async getKpiEnabled() {
    const enabled = await this.systemConfigService.isKpiEvaluationEnabled();
    return { enabled };
  }

  @Put('commission/kpi-enabled')
  @Permissions('system:update')
  @ApiOperation({ summary: 'Set KPI evaluation enabled status' })
  @ApiResponse({ status: 200, description: 'KPI enabled status updated successfully' })
  async setKpiEnabled(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: { enabled: boolean },
  ) {
    const result = await this.systemConfigService.setKpiEvaluationEnabled(dto.enabled);

    await this.auditService.log({
      userId: admin.id,
      action: 'KPI_ENABLED_UPDATED',
      targetType: 'system_config',
      targetId: 'kpi_evaluation_enabled',
      metadata: { enabled: dto.enabled },
    });

    return result;
  }
}
