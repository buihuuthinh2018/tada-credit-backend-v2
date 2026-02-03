import { Module } from '@nestjs/common';
import { ServiceService } from './service.service';
import { ServiceController, AdminServiceController } from './service.controller';

@Module({
  providers: [ServiceService],
  controllers: [ServiceController, AdminServiceController],
  exports: [ServiceService],
})
export class ServiceModule {}
