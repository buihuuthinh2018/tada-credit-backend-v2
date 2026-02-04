import { Module, forwardRef } from '@nestjs/common';
import { CommissionService } from './commission.service';
import { 
  CommissionController, 
  AdminCommissionController, 
  AdminKpiTierController,
  AdminSnapshotController 
} from './commission.controller';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  providers: [CommissionService],
  controllers: [
    CommissionController, 
    AdminCommissionController,
    AdminKpiTierController,
    AdminSnapshotController,
  ],
  exports: [CommissionService],
})
export class CommissionModule {}
