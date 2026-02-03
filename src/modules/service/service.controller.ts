import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ServiceService } from './service.service';
import { CreateServiceDto, UpdateServiceDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser, Public } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/interfaces';

@Controller('services')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Get()
  @Public()
  getActiveServices() {
    return this.serviceService.getActiveServices();
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.serviceService.findById(id);
  }
}

@Controller('admin/services')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminServiceController {
  constructor(
    private readonly serviceService: ServiceService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Permissions('service:create')
  async create(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateServiceDto,
  ) {
    const result = await this.serviceService.create(dto);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'SERVICE_CREATED',
      targetType: 'service',
      targetId: result.id,
      metadata: { name: result.name },
    });

    return result;
  }

  @Get()
  @Permissions('service:read')
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('activeOnly') activeOnly = false,
  ) {
    return this.serviceService.findAll(page, limit, activeOnly);
  }

  @Get(':id')
  @Permissions('service:read')
  findOne(@Param('id') id: string) {
    return this.serviceService.findById(id);
  }

  @Put(':id')
  @Permissions('service:update')
  async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    const result = await this.serviceService.update(id, dto);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'SERVICE_UPDATED',
      targetType: 'service',
      targetId: id,
      metadata: { changes: dto },
    });

    return result;
  }

  @Post(':id/documents/:docId')
  @Permissions('service:update')
  async addDocumentRequirement(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') serviceId: string,
    @Param('docId') documentRequirementId: string,
    @Query('required') required = true,
  ) {
    const result = await this.serviceService.addDocumentRequirement(
      serviceId,
      documentRequirementId,
      required,
    );
    
    await this.auditService.log({
      userId: admin.id,
      action: 'SERVICE_DOCUMENT_ADDED',
      targetType: 'service',
      targetId: serviceId,
      metadata: { documentRequirementId },
    });

    return result;
  }

  @Delete(':id/documents/:docId')
  @Permissions('service:update')
  async removeDocumentRequirement(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') serviceId: string,
    @Param('docId') documentRequirementId: string,
  ) {
    const result = await this.serviceService.removeDocumentRequirement(
      serviceId,
      documentRequirementId,
    );
    
    await this.auditService.log({
      userId: admin.id,
      action: 'SERVICE_DOCUMENT_REMOVED',
      targetType: 'service',
      targetId: serviceId,
      metadata: { documentRequirementId },
    });

    return result;
  }

  @Post(':id/questions/:questionId')
  @Permissions('service:update')
  async addQuestion(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') serviceId: string,
    @Param('questionId') questionId: string,
    @Query('required') required = true,
    @Query('sortOrder') sortOrder = 0,
  ) {
    const result = await this.serviceService.addQuestion(
      serviceId,
      questionId,
      required,
      sortOrder,
    );
    
    await this.auditService.log({
      userId: admin.id,
      action: 'SERVICE_QUESTION_ADDED',
      targetType: 'service',
      targetId: serviceId,
      metadata: { questionId },
    });

    return result;
  }

  @Delete(':id/questions/:questionId')
  @Permissions('service:update')
  async removeQuestion(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') serviceId: string,
    @Param('questionId') questionId: string,
  ) {
    const result = await this.serviceService.removeQuestion(serviceId, questionId);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'SERVICE_QUESTION_REMOVED',
      targetType: 'service',
      targetId: serviceId,
      metadata: { questionId },
    });

    return result;
  }
}
