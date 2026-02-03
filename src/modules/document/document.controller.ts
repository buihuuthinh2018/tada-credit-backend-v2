import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { DocumentService } from './document.service';
import { CreateDocumentRequirementDto, UpdateDocumentRequirementDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/interfaces';
import { contract_document_status } from '@prisma/client';

@Controller('admin/document-requirements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocumentRequirementController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Permissions('document:create')
  async create(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateDocumentRequirementDto,
  ) {
    const result = await this.documentService.createRequirement(dto);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'DOCUMENT_REQUIREMENT_CREATED',
      targetType: 'document_requirement',
      targetId: result.id,
      metadata: { code: result.code },
    });

    return result;
  }

  @Get()
  @Permissions('document:read')
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('activeOnly') activeOnly = false,
  ) {
    return this.documentService.findAllRequirements(page, limit, activeOnly);
  }

  @Get(':id')
  @Permissions('document:read')
  findOne(@Param('id') id: string) {
    return this.documentService.findRequirementById(id);
  }

  @Put(':id')
  @Permissions('document:update')
  async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentRequirementDto,
  ) {
    const result = await this.documentService.updateRequirement(id, dto);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'DOCUMENT_REQUIREMENT_UPDATED',
      targetType: 'document_requirement',
      targetId: id,
      metadata: { changes: dto },
    });

    return result;
  }
}

@Controller('admin/contract-documents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContractDocumentController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly auditService: AuditService,
  ) {}

  @Patch(':id/review')
  @Permissions('document:review')
  async reviewDocument(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') documentId: string,
    @Body() body: { status: contract_document_status; reviewNote?: string },
  ) {
    const result = await this.documentService.reviewDocument(
      documentId,
      body.status,
      body.reviewNote,
      admin.id,
    );
    
    await this.auditService.log({
      userId: admin.id,
      action: 'DOCUMENT_REVIEWED',
      targetType: 'contract_document',
      targetId: documentId,
      metadata: { status: body.status, reviewNote: body.reviewNote },
    });

    return result;
  }

  @Get('contract/:contractId')
  @Permissions('contract:read')
  getContractDocuments(@Param('contractId') contractId: string) {
    return this.documentService.getContractDocuments(contractId);
  }

  @Delete('files/:fileId')
  @Permissions('document:delete')
  async deleteFile(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('fileId') fileId: string,
  ) {
    const result = await this.documentService.deleteFile(fileId);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'DOCUMENT_FILE_DELETED',
      targetType: 'contract_document_file',
      targetId: fileId,
    });

    return result;
  }
}
