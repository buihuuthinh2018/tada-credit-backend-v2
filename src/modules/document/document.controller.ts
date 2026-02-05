import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { DocumentService } from './document.service';
import { CreateDocumentRequirementDto, UpdateDocumentRequirementDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/interfaces';
import { contract_document_status } from '@prisma/client';

@ApiTags('Document Requirements')
@ApiBearerAuth('JWT-auth')
@Controller('admin/document-requirements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocumentRequirementController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Permissions('document:create')
  @ApiOperation({ summary: 'Create a new document requirement' })
  @ApiResponse({ status: 201, description: 'Document requirement created successfully' })
  @ApiResponse({ status: 409, description: 'Document requirement code already exists' })
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
  @ApiOperation({ summary: 'Get all document requirements' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean, example: false })
  @ApiResponse({ status: 200, description: 'Returns paginated list of document requirements' })
  findAll(
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
    @Query('activeOnly') activeOnly = false,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.documentService.findAllRequirements(pageNum, limitNum, activeOnly);
  }

  @Get(':id')
  @Permissions('document:read')
  @ApiOperation({ summary: 'Get document requirement by ID' })
  @ApiParam({ name: 'id', description: 'Document requirement ID' })
  @ApiResponse({ status: 200, description: 'Returns document requirement details' })
  @ApiResponse({ status: 404, description: 'Document requirement not found' })
  findOne(@Param('id') id: string) {
    return this.documentService.findRequirementById(id);
  }

  @Put(':id')
  @Permissions('document:update')
  @ApiOperation({ summary: 'Update document requirement' })
  @ApiParam({ name: 'id', description: 'Document requirement ID' })
  @ApiResponse({ status: 200, description: 'Document requirement updated successfully' })
  @ApiResponse({ status: 404, description: 'Document requirement not found' })
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

@ApiTags('Contract Documents')
@ApiBearerAuth('JWT-auth')
@Controller('admin/contract-documents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContractDocumentController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly auditService: AuditService,
  ) {}

  // Document review functionality disabled - admin reviews manually without approval workflow
  // @Patch(':id/review')
  // @Permissions('document:review')
  // @ApiOperation({ summary: 'Review a contract document' })
  // @ApiParam({ name: 'id', description: 'Contract document ID' })
  // @ApiBody({ schema: { properties: { status: { enum: ['APPROVED', 'REJECTED'] }, reviewNote: { type: 'string' } } } })
  // @ApiResponse({ status: 200, description: 'Document reviewed successfully' })
  // @ApiResponse({ status: 400, description: 'Document has already been reviewed' })
  // @ApiResponse({ status: 404, description: 'Document not found' })
  // async reviewDocument(
  //   @CurrentUser() admin: AuthenticatedUser,
  //   @Param('id') documentId: string,
  //   @Body() body: { status: contract_document_status; reviewNote?: string },
  // ) {
  //   const result = await this.documentService.reviewDocument(
  //     documentId,
  //     body.status,
  //     body.reviewNote,
  //     admin.id,
  //   );
  //   
  //   await this.auditService.log({
  //     userId: admin.id,
  //     action: 'DOCUMENT_REVIEWED',
  //     targetType: 'contract_document',
  //     targetId: documentId,
  //     metadata: { status: body.status, reviewNote: body.reviewNote },
  //   });
  //
  //   return result;
  // }

  @Get('contract/:contractId')
  @Permissions('contract:read')
  @ApiOperation({ summary: 'Get all documents for a contract' })
  @ApiParam({ name: 'contractId', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Returns list of contract documents' })
  getContractDocuments(@Param('contractId') contractId: string) {
    return this.documentService.getContractDocuments(contractId);
  }

  @Delete('files/:fileId')
  @Permissions('document:delete')
  @ApiOperation({ summary: 'Delete a document file' })
  @ApiParam({ name: 'fileId', description: 'File ID to delete' })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete file from reviewed document' })
  @ApiResponse({ status: 404, description: 'File not found' })
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
