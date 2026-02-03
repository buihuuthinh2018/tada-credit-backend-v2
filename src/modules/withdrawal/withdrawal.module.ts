import { Module } from '@nestjs/common';
import { WithdrawalService } from './withdrawal.service';
import { WithdrawalController, AdminWithdrawalController } from './withdrawal.controller';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  providers: [WithdrawalService],
  controllers: [WithdrawalController, AdminWithdrawalController],
  exports: [WithdrawalService],
})
export class WithdrawalModule {}
