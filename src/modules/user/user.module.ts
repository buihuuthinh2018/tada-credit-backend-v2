import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController, AdminUserController } from './user.controller';

@Module({
  providers: [UserService],
  controllers: [UserController, AdminUserController],
  exports: [UserService],
})
export class UserModule {}
