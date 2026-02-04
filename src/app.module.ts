import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { RoleModule } from './modules/role/role.module';
import { PermissionModule } from './modules/permission/permission.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { ServiceModule } from './modules/service/service.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { ContractModule } from './modules/contract/contract.module';
import { DocumentModule } from './modules/document/document.module';
import { QuestionModule } from './modules/question/question.module';
import { CommissionModule } from './modules/commission/commission.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { WithdrawalModule } from './modules/withdrawal/withdrawal.module';
import { AuditModule } from './modules/audit/audit.module';
import { StorageModule } from './modules/storage/storage.module';
import { FileAccessModule } from './modules/file-access/file-access.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { SystemConfigModule } from './modules/system-config/system-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    UserModule,
    RoleModule,
    PermissionModule,
    RbacModule,
    ServiceModule,
    WorkflowModule,
    ContractModule,
    DocumentModule,
    QuestionModule,
    CommissionModule,
    WalletModule,
    WithdrawalModule,
    AuditModule,
    FileAccessModule,
    SchedulerModule,
    SystemConfigModule,
  ],
})
export class AppModule {}
