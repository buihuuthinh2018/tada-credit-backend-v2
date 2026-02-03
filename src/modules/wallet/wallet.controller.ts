import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuthenticatedUser } from '../../common/interfaces';

@Controller('wallet')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  getMyWallet(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.getWalletByUserId(user.id);
  }

  @Get('balance')
  getMyBalance(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.getBalance(user.id).then((balance) => ({ balance }));
  }

  @Get('transactions')
  getMyTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.walletService.getTransactionsByUser(user.id, page, limit);
  }
}

@Controller('admin/wallets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminWalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('user/:userId')
  @Permissions('wallet:read')
  getWalletByUser(@Param('userId') userId: string) {
    return this.walletService.getWalletByUserId(userId);
  }

  @Get('user/:userId/transactions')
  @Permissions('wallet:read')
  getTransactionsByUser(
    @Param('userId') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.walletService.getTransactionsByUser(userId, page, limit);
  }

  @Get(':walletId/verify')
  @Permissions('wallet:verify')
  verifyWalletIntegrity(@Param('walletId') walletId: string) {
    return this.walletService.verifyWalletIntegrity(walletId);
  }
}
