import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CommissionService } from './commission.service';
import { CreateCommissionConfigDto, UpdateCommissionConfigDto, CreateKpiTierDto, UpdateKpiTierDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/interfaces';

// ==========================================
// User Commission Controller
// ==========================================

@ApiTags('Commission')
@ApiBearerAuth('JWT-auth')
@Controller('commission')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommissionController {
  constructor(private readonly commissionService: CommissionService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get current user commission summary' })
  @ApiResponse({ status: 200, description: 'Returns commission summary' })
  getMyCommissionSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.commissionService.getUserCommissionSummary(user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get current user commission history' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Returns paginated commission history' })
  getMyCommissionHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.commissionService.getCommissionHistory(user.id, pageNum, limitNum);
  }

  @Get('records')
  @ApiOperation({ summary: 'Get current user commission records' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, type: String, example: 'CREDITED' })
  @ApiResponse({ status: 200, description: 'Returns paginated commission records' })
  getMyCommissionRecords(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
    @Query('status') status?: string,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.commissionService.getCommissionRecords(user.id, pageNum, limitNum, status);
  }

  @Get('snapshots')
  @ApiOperation({ summary: 'Get current user monthly snapshots' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Returns paginated monthly snapshots' })
  getMySnapshots(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.commissionService.getUserSnapshots(user.id, pageNum, limitNum);
  }
}

// ==========================================
// Admin Commission Config Controller
// ==========================================

@ApiTags('Admin - Commission Config')
@ApiBearerAuth('JWT-auth')
@Controller('admin/commission-configs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminCommissionController {
  constructor(
    private readonly commissionService: CommissionService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Permissions('commission:create')
  @ApiOperation({ summary: 'Create commission configuration' })
  @ApiResponse({ status: 201, description: 'Commission configuration created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid configuration data' })
  async create(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateCommissionConfigDto,
  ) {
    const result = await this.commissionService.createConfig(dto);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'COMMISSION_CONFIG_CREATED',
      targetType: 'commission_config',
      targetId: result.id,
      metadata: { roleCode: dto.roleCode, rate: dto.rate },
    });

    return result;
  }

  @Get()
  @Permissions('commission:read')
  @ApiOperation({ summary: 'Get all commission configurations' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Returns paginated list of commission configurations' })
  findAll(
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.commissionService.findAllConfigs(pageNum, limitNum);
  }

  @Get(':id')
  @Permissions('commission:read')
  @ApiOperation({ summary: 'Get commission configuration by ID' })
  @ApiParam({ name: 'id', description: 'Commission configuration ID' })
  @ApiResponse({ status: 200, description: 'Returns commission configuration details' })
  @ApiResponse({ status: 404, description: 'Commission configuration not found' })
  findOne(@Param('id') id: string) {
    return this.commissionService.findConfigById(id);
  }

  @Put(':id')
  @Permissions('commission:update')
  @ApiOperation({ summary: 'Update commission configuration' })
  @ApiParam({ name: 'id', description: 'Commission configuration ID' })
  @ApiResponse({ status: 200, description: 'Commission configuration updated successfully' })
  @ApiResponse({ status: 404, description: 'Commission configuration not found' })
  async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCommissionConfigDto,
  ) {
    const result = await this.commissionService.updateConfig(id, dto);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'COMMISSION_CONFIG_UPDATED',
      targetType: 'commission_config',
      targetId: id,
      metadata: { changes: dto },
    });

    return result;
  }
}

// ==========================================
// Admin KPI Tier Controller
// ==========================================

@ApiTags('Admin - KPI Tiers')
@ApiBearerAuth('JWT-auth')
@Controller('admin/kpi-tiers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminKpiTierController {
  constructor(
    private readonly commissionService: CommissionService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Permissions('commission:create')
  @ApiOperation({ summary: 'Create KPI tier' })
  @ApiResponse({ status: 201, description: 'KPI tier created successfully' })
  async create(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateKpiTierDto,
  ) {
    const result = await this.commissionService.createKpiTier(dto);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'KPI_TIER_CREATED',
      targetType: 'kpi_commission_tier',
      targetId: result.id,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return result;
  }

  @Get()
  @Permissions('commission:read')
  @ApiOperation({ summary: 'Get all KPI tiers' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'roleCode', required: false, type: String, example: 'CTV' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of KPI tiers' })
  findAll(
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
    @Query('roleCode') roleCode?: string,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.commissionService.findAllKpiTiers(pageNum, limitNum, roleCode);
  }

  @Get(':id')
  @Permissions('commission:read')
  @ApiOperation({ summary: 'Get KPI tier by ID' })
  @ApiParam({ name: 'id', description: 'KPI tier ID' })
  @ApiResponse({ status: 200, description: 'Returns KPI tier details' })
  @ApiResponse({ status: 404, description: 'KPI tier not found' })
  findOne(@Param('id') id: string) {
    return this.commissionService.findKpiTierById(id);
  }

  @Put(':id')
  @Permissions('commission:update')
  @ApiOperation({ summary: 'Update KPI tier' })
  @ApiParam({ name: 'id', description: 'KPI tier ID' })
  @ApiResponse({ status: 200, description: 'KPI tier updated successfully' })
  @ApiResponse({ status: 404, description: 'KPI tier not found' })
  async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateKpiTierDto,
  ) {
    const result = await this.commissionService.updateKpiTier(id, dto);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'KPI_TIER_UPDATED',
      targetType: 'kpi_commission_tier',
      targetId: id,
      metadata: { changes: dto },
    });

    return result;
  }

  @Delete(':id')
  @Permissions('commission:delete')
  @ApiOperation({ summary: 'Delete KPI tier' })
  @ApiParam({ name: 'id', description: 'KPI tier ID' })
  @ApiResponse({ status: 200, description: 'KPI tier deleted successfully' })
  @ApiResponse({ status: 404, description: 'KPI tier not found' })
  async delete(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const result = await this.commissionService.deleteKpiTier(id);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'KPI_TIER_DELETED',
      targetType: 'kpi_commission_tier',
      targetId: id,
      metadata: {},
    });

    return result;
  }
}

// ==========================================
// Admin Snapshot Controller
// ==========================================

@ApiTags('Admin - Commission Snapshots')
@ApiBearerAuth('JWT-auth')
@Controller('admin/commission-snapshots')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminSnapshotController {
  constructor(
    private readonly commissionService: CommissionService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @Permissions('commission:read')
  @ApiOperation({ summary: 'Get all snapshots' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2026 })
  @ApiQuery({ name: 'month', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'status', required: false, type: String, example: 'PENDING' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of snapshots' })
  findAll(
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
    @Query('year') year?: string | number,
    @Query('month') month?: string | number,
    @Query('status') status?: string,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    const yearNum = year ? (typeof year === 'string' ? parseInt(year, 10) : year) : undefined;
    const monthNum = month ? (typeof month === 'string' ? parseInt(month, 10) : month) : undefined;
    
    return this.commissionService.getAllSnapshots(pageNum, limitNum, { 
      year: yearNum, 
      month: monthNum, 
      status 
    });
  }

  @Post(':id/process')
  @Permissions('commission:update')
  @ApiOperation({ summary: 'Process snapshot bonus' })
  @ApiParam({ name: 'id', description: 'Snapshot ID' })
  @ApiResponse({ status: 200, description: 'Snapshot processed successfully' })
  @ApiResponse({ status: 404, description: 'Snapshot not found' })
  async processBonus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.commissionService.processSnapshotBonus(id, admin.id);
  }

  @Post('create-monthly')
  @Permissions('commission:create')
  @ApiOperation({ summary: 'Manually create monthly snapshot for a user' })
  @ApiQuery({ name: 'userId', required: true, type: String })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiQuery({ name: 'month', required: true, type: Number })
  @ApiResponse({ status: 201, description: 'Snapshot created successfully' })
  async createManualSnapshot(
    @CurrentUser() admin: AuthenticatedUser,
    @Query('userId') userId: string,
    @Query('year') year: string | number,
    @Query('month') month: string | number,
  ) {
    const yearNum = typeof year === 'string' ? parseInt(year, 10) : year;
    const monthNum = typeof month === 'string' ? parseInt(month, 10) : month;
    
    const result = await this.commissionService.createMonthlySnapshot(userId, yearNum, monthNum);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'COMMISSION_SNAPSHOT_MANUAL_CREATE',
      targetType: 'commission_snapshot',
      targetId: result.id,
      metadata: { userId, year: yearNum, month: monthNum },
    });

    return result;
  }
}
