import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { CommissionService } from './commission.service';
import { CreateCommissionConfigDto, UpdateCommissionConfigDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/interfaces';

@Controller('commission')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommissionController {
  constructor(private readonly commissionService: CommissionService) {}

  @Get('history')
  getMyCommissionHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.commissionService.getCommissionHistory(user.id, page, limit);
  }
}

@Controller('admin/commission-configs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminCommissionController {
  constructor(
    private readonly commissionService: CommissionService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Permissions('commission:create')
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
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.commissionService.findAllConfigs(page, limit);
  }

  @Get(':id')
  @Permissions('commission:read')
  findOne(@Param('id') id: string) {
    return this.commissionService.findConfigById(id);
  }

  @Put(':id')
  @Permissions('commission:update')
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
