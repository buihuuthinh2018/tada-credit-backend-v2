import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { StorageModule } from "../storage/storage.module";
import { AuthModule } from "../auth/auth.module";
import { ConfigModule } from "@nestjs/config";
import {
  FileAccessController,
  PublicFileAccessController,
} from "./file-access.controller";
import { FileAccessService } from "./file-access.service";

@Module({
  imports: [PrismaModule, StorageModule, AuthModule, ConfigModule],
  controllers: [FileAccessController, PublicFileAccessController],
  providers: [FileAccessService],
  exports: [FileAccessService],
})
export class FileAccessModule {}
