import { Controller, Get, Post, Put, Patch, Param, Body, Query, UseGuards, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FilesInterceptor, AnyFilesInterceptor } from '@nestjs/platform-express';
import { ContractService } from './contract.service';
import { CreateContractDto, TransitionContractDto, AnswerDto, SubmitContractDto, UpdateDisbursementDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuthenticatedUser } from '../../common/interfaces';
@ApiTags('Contracts')
@ApiBearerAuth('JWT-auth')
@Controller('contracts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new contract/loan application' })
  @ApiResponse({ status: 201, description: 'Contract created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid contract data' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateContractDto,
  ) {
    return this.contractService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get current user contracts' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'type', required: false, enum: ['owned', 'created'], description: 'owned = contracts where user is owner, created = contracts CTV created for others' })
  @ApiQuery({ name: 'serviceId', required: false, type: String })
  @ApiQuery({ name: 'stageCode', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Returns paginated list of user contracts' })
  findMyContracts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
    @Query('type') type?: 'owned' | 'created',
    @Query('serviceId') serviceId?: string,
    @Query('stageCode') stageCode?: string,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.contractService.findByUser(user.id, pageNum, limitNum, { type, serviceId, stageCode });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contract by ID' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Returns contract details' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.contractService.findById(id);
  }

  @Put(':id/answers')
  @ApiOperation({ summary: 'Update contract answers/form data' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Contract answers updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid answers data' })
  @ApiResponse({ status: 403, description: 'Not authorized to update this contract' })
  updateAnswers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { answers: AnswerDto[] },
  ) {
    return this.contractService.updateAnswers(id, user.id, body.answers);
  }

  @Get(':id/transitions')
  @ApiOperation({ summary: 'Get available workflow transitions for contract' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Returns list of available transitions' })
  getAvailableTransitions(@Param('id') id: string) {
    return this.contractService.getAvailableTransitions(id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get contract stage history' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Returns contract stage transition history' })
  getStageHistory(@Param('id') id: string) {
    return this.contractService.getStageHistory(id);
  }

  @Post(':id/documents/:docReqId/upload')
  @UseInterceptors(FilesInterceptor('files', 10, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  }))
  @ApiOperation({ summary: 'Upload document files for contract' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiParam({ name: 'docReqId', description: 'Document requirement ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Documents uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid document data' })
  @ApiResponse({ status: 404, description: 'Contract or document requirement not found' })
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') contractId: string,
    @Param('docReqId') documentRequirementId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.contractService.uploadDocuments(
      contractId,
      documentRequirementId,
      files,
      user.id,
    );
  }

  @Post(':id/submit')
  @UseInterceptors(AnyFilesInterceptor({
    limits: { fileSize: 10 * 1024 * 1024, files: 30 }, // 10MB per file, max 30 files
  }))
  @ApiOperation({ 
    summary: 'Submit contract with answers and documents',
    description: 'Submit contract application with all answers and upload all document files at once. Files should be sent with field names like files_{documentRequirementId}'
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        answers: {
          type: 'string',
          description: 'JSON string of answers array: [{"questionId": "uuid", "answer": "value"}]',
        },
        'files_{docReqId}': {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Files for each document requirement. Replace {docReqId} with actual document requirement ID',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Contract submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or missing required documents' })
  @ApiResponse({ status: 403, description: 'Not authorized to submit this contract' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  submitContract(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') contractId: string,
    @Body('answers') answersJson: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    // Parse answers from JSON string
    let answers: AnswerDto[] = [];
    if (answersJson) {
      try {
        answers = JSON.parse(answersJson);
      } catch {
        // If not valid JSON, try to handle as-is
        answers = [];
      }
    }

    // Group files by document requirement ID
    const filesByDocReq: Record<string, Express.Multer.File[]> = {};
    files.forEach((file) => {
      // Field name format: files_{docReqId}
      const match = file.fieldname.match(/^files_(.+)$/);
      if (match) {
        const docReqId = match[1];
        if (!filesByDocReq[docReqId]) {
          filesByDocReq[docReqId] = [];
        }
        filesByDocReq[docReqId].push(file);
      }
    });

    return this.contractService.submitContract(
      contractId,
      user.id,
      answers,
      filesByDocReq,
    );
  }
}

@ApiTags('Contracts')
@ApiBearerAuth('JWT-auth')
@Controller('admin/contracts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminContractController {
  constructor(private readonly contractService: ContractService) {}

  @Get()
  @Permissions('contract:read')
  @ApiOperation({ summary: 'Get all contracts (Admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'serviceId', required: false, description: 'Filter by service ID' })
  @ApiQuery({ name: 'stageId', required: false, description: 'Filter by stage ID' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by email, phone, fullname, or contract number' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of all contracts' })
  findAll(
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
    @Query('serviceId') serviceId?: string,
    @Query('stageId') stageId?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.contractService.findAll(pageNum, limitNum, { serviceId, stageId, search });
  }

  @Get(':id')
  @Permissions('contract:read')
  @ApiOperation({ summary: 'Get contract by ID (Admin)' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Returns contract details' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  findOne(@Param('id') id: string) {
    return this.contractService.findById(id);
  }

  @Patch(':id/transition')
  @Permissions('contract:transition')
  @ApiOperation({ summary: 'Transition contract to next workflow stage (Admin)' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Contract transitioned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid transition or missing requirements' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  transition(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TransitionContractDto,
  ) {
    return this.contractService.transitionStage(id, dto, admin.id);
  }

  @Patch(':id/disbursement')
  @Permissions('contract:update')
  @ApiOperation({ summary: 'Update disbursed amount for a contract (Admin)' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Disbursement amount updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid amount or contract state' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  updateDisbursement(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDisbursementDto,
  ) {
    return this.contractService.updateDisbursedAmount(id, dto.disbursedAmount, admin.id);
  }

  @Get(':id/transitions')
  @Permissions('contract:read')
  @ApiOperation({ summary: 'Get available transitions for contract (Admin)' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Returns list of available transitions' })
  getAvailableTransitions(@Param('id') id: string) {
    return this.contractService.getAvailableTransitions(id);
  }

  @Get(':id/history')
  @Permissions('contract:read')
  @ApiOperation({ summary: 'Get contract stage history (Admin)' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Returns contract stage transition history' })
  getStageHistory(@Param('id') id: string) {
    return this.contractService.getStageHistory(id);
  }
}
