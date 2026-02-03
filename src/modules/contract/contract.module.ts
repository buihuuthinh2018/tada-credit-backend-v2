import { Module, forwardRef } from '@nestjs/common';
import { ContractService } from './contract.service';
import { ContractController, AdminContractController } from './contract.controller';
import { WorkflowModule } from '../workflow/workflow.module';
import { CommissionModule } from '../commission/commission.module';

@Module({
  imports: [
    WorkflowModule,
    forwardRef(() => CommissionModule),
  ],
  providers: [ContractService],
  controllers: [ContractController, AdminContractController],
  exports: [ContractService],
})
export class ContractModule {}
