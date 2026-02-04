import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuthenticatedUser } from '../../common/interfaces';

@ApiTags('Wallet')
@ApiBearerAuth('JWT-auth')
@Controller('wallet')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user wallet' })
  @ApiResponse({ status: 200, description: 'Returns user wallet details' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  getMyWallet(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.getWalletByUserId(user.id);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get current user wallet balance' })
  @ApiResponse({ status: 200, description: 'Returns wallet balance' })
  getMyBalance(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.getBalance(user.id).then((balance) => ({ balance }));
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get current user wallet transactions' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Returns paginated list of transactions' })
  getMyTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.walletService.getTransactionsByUser(user.id, pageNum, limitNum);
  }
}

@ApiTags('Wallet')
@ApiBearerAuth('JWT-auth')
@Controller('admin/wallets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminWalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('user/:userId')
  @Permissions('wallet:read')
  @ApiOperation({ summary: 'Get user wallet by user ID (Admin)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Returns user wallet details' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  getWalletByUser(@Param('userId') userId: string) {
    return this.walletService.getWalletByUserId(userId);
  }

  @Get('user/:userId/transactions')
  @Permissions('wallet:read')
  @ApiOperation({ summary: 'Get user wallet transactions (Admin)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Returns paginated list of transactions' })
  getTransactionsByUser(
    @Param('userId') userId: string,
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.walletService.getTransactionsByUser(userId, pageNum, limitNum);
  }

  @Get(':walletId/verify')
  @Permissions('wallet:verify')
  @ApiOperation({ summary: 'Verify wallet integrity - compare stored vs calculated balance' })
  @ApiParam({ name: 'walletId', description: 'Wallet ID' })
  @ApiResponse({ status: 200, description: 'Returns wallet integrity verification result' })
  verifyWalletIntegrity(@Param('walletId') walletId: string) {
    return this.walletService.verifyWalletIntegrity(walletId);
  }
}
