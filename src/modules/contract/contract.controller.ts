import { Controller, Get, Post, Put, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ContractService } from './contract.service';
import { CreateContractDto, TransitionContractDto, AnswerDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuthenticatedUser } from '../../common/interfaces';

@Controller('contracts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateContractDto,
  ) {
    return this.contractService.create(user.id, dto);
  }

  @Get()
  findMyContracts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.contractService.findByUser(user.id, page, limit);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.contractService.findById(id);
  }

  @Put(':id/answers')
  updateAnswers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { answers: AnswerDto[] },
  ) {
    return this.contractService.updateAnswers(id, user.id, body.answers);
  }

  @Get(':id/transitions')
  getAvailableTransitions(@Param('id') id: string) {
    return this.contractService.getAvailableTransitions(id);
  }

  @Get(':id/history')
  getStageHistory(@Param('id') id: string) {
    return this.contractService.getStageHistory(id);
  }

  @Post(':id/documents/:docReqId/upload')
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') contractId: string,
    @Param('docReqId') documentRequirementId: string,
    @Body() body: { fileUrl: string; fileName?: string; fileSize?: number; mimeType?: string },
  ) {
    return this.contractService.uploadDocument(
      contractId,
      documentRequirementId,
      body.fileUrl,
      body.fileName,
      body.fileSize,
      body.mimeType,
    );
  }
}

@Controller('admin/contracts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminContractController {
  constructor(private readonly contractService: ContractService) {}

  @Get()
  @Permissions('contract:read')
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('serviceId') serviceId?: string,
    @Query('stageId') stageId?: string,
  ) {
    return this.contractService.findAll(page, limit, { serviceId, stageId });
  }

  @Get(':id')
  @Permissions('contract:read')
  findOne(@Param('id') id: string) {
    return this.contractService.findById(id);
  }

  @Patch(':id/transition')
  @Permissions('contract:transition')
  transition(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TransitionContractDto,
  ) {
    return this.contractService.transitionStage(id, dto, admin.id);
  }

  @Get(':id/transitions')
  @Permissions('contract:read')
  getAvailableTransitions(@Param('id') id: string) {
    return this.contractService.getAvailableTransitions(id);
  }

  @Get(':id/history')
  @Permissions('contract:read')
  getStageHistory(@Param('id') id: string) {
    return this.contractService.getStageHistory(id);
  }
}
