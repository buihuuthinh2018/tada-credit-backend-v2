import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentRequirementController, ContractDocumentController } from './document.controller';

@Module({
  providers: [DocumentService],
  controllers: [DocumentRequirementController, ContractDocumentController],
  exports: [DocumentService],
})
export class DocumentModule {}
