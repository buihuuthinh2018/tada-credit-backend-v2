import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { WithdrawalService } from './withdrawal.service';
import { CreateWithdrawalDto, ProcessWithdrawalDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuthenticatedUser } from '../../common/interfaces';
import { withdrawal_status } from '@prisma/client';

@Controller('withdrawals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WithdrawalController {
  constructor(private readonly withdrawalService: WithdrawalService) {}

  @Post()
  createRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWithdrawalDto,
  ) {
    return this.withdrawalService.createRequest(user.id, dto);
  }

  @Get()
  getMyWithdrawals(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.withdrawalService.findByUser(user.id, page, limit);
  }

  @Get(':id')
  getMyWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.withdrawalService.findById(id);
  }

  @Patch(':id/cancel')
  cancelRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.withdrawalService.cancelRequest(id, user.id);
  }
}

@Controller('admin/withdrawals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminWithdrawalController {
  constructor(private readonly withdrawalService: WithdrawalService) {}

  @Get()
  @Permissions('withdrawal:read')
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: withdrawal_status,
  ) {
    return this.withdrawalService.findAll(page, limit, status);
  }

  @Get(':id')
  @Permissions('withdrawal:read')
  findOne(@Param('id') id: string) {
    return this.withdrawalService.findById(id);
  }

  @Patch(':id/process')
  @Permissions('withdrawal:process')
  processRequest(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ProcessWithdrawalDto,
  ) {
    return this.withdrawalService.processRequest(id, admin.id, dto);
  }
}
