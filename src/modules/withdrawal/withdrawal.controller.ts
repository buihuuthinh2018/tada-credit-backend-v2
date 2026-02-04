import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { WithdrawalService } from './withdrawal.service';
import { CreateWithdrawalDto, ProcessWithdrawalDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuthenticatedUser } from '../../common/interfaces';
import { withdrawal_status } from '@prisma/client';

@ApiTags('Withdrawals')
@ApiBearerAuth('JWT-auth')
@Controller('withdrawals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WithdrawalController {
  constructor(private readonly withdrawalService: WithdrawalService) {}

  @Post()
  @ApiOperation({ summary: 'Create a withdrawal request' })
  @ApiResponse({ status: 201, description: 'Withdrawal request created successfully' })
  @ApiResponse({ status: 400, description: 'Insufficient balance or pending request exists' })
  createRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWithdrawalDto,
  ) {
    return this.withdrawalService.createRequest(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get current user withdrawal requests' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Returns paginated list of withdrawal requests' })
  getMyWithdrawals(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.withdrawalService.findByUser(user.id, pageNum, limitNum);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get withdrawal request by ID' })
  @ApiParam({ name: 'id', description: 'Withdrawal request ID' })
  @ApiResponse({ status: 200, description: 'Returns withdrawal request details' })
  @ApiResponse({ status: 404, description: 'Withdrawal request not found' })
  getMyWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.withdrawalService.findById(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel withdrawal request' })
  @ApiParam({ name: 'id', description: 'Withdrawal request ID' })
  @ApiResponse({ status: 200, description: 'Withdrawal request cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Cannot cancel withdrawal in current status' })
  @ApiResponse({ status: 403, description: 'Not authorized to cancel this withdrawal' })
  cancelRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.withdrawalService.cancelRequest(id, user.id);
  }
}

@ApiTags('Withdrawals')
@ApiBearerAuth('JWT-auth')
@Controller('admin/withdrawals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminWithdrawalController {
  constructor(private readonly withdrawalService: WithdrawalService) {}

  @Get()
  @Permissions('withdrawal:read')
  @ApiOperation({ summary: 'Get all withdrawal requests (Admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'PAID', 'REJECTED'] })
  @ApiResponse({ status: 200, description: 'Returns paginated list of withdrawal requests' })
  findAll(
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
    @Query('status') status?: withdrawal_status,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.withdrawalService.findAll(pageNum, limitNum, status);
  }

  @Get(':id')
  @Permissions('withdrawal:read')
  @ApiOperation({ summary: 'Get withdrawal request by ID (Admin)' })
  @ApiParam({ name: 'id', description: 'Withdrawal request ID' })
  @ApiResponse({ status: 200, description: 'Returns withdrawal request details' })
  @ApiResponse({ status: 404, description: 'Withdrawal request not found' })
  findOne(@Param('id') id: string) {
    return this.withdrawalService.findById(id);
  }

  @Patch(':id/process')
  @Permissions('withdrawal:process')
  @ApiOperation({ summary: 'Process withdrawal request (approve/reject/mark paid)' })
  @ApiParam({ name: 'id', description: 'Withdrawal request ID' })
  @ApiResponse({ status: 200, description: 'Withdrawal request processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition or missing proof' })
  @ApiResponse({ status: 404, description: 'Withdrawal request not found' })
  processRequest(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ProcessWithdrawalDto,
  ) {
    return this.withdrawalService.processRequest(id, admin.id, dto);
  }
}
