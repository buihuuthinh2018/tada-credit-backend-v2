import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController, AdminWalletController } from './wallet.controller';

@Module({
  providers: [WalletService],
  controllers: [WalletController, AdminWalletController],
  exports: [WalletService],
})
export class WalletModule {}
