import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ServiceService } from './service.service';
import { CreateServiceDto, UpdateServiceDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser, Public } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/interfaces';

@ApiTags('Services')
@Controller('services')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all active services (Public)' })
  @ApiResponse({ status: 200, description: 'Returns list of active services' })
  getActiveServices() {
    return this.serviceService.getActiveServices();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get service by ID (Public)' })
  @ApiParam({ name: 'id', description: 'Service ID' })
  @ApiResponse({ status: 200, description: 'Returns service details' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  findOne(@Param('id') id: string) {
    return this.serviceService.findById(id);
  }
}

@ApiTags('Services')
@ApiBearerAuth('JWT-auth')
@Controller('admin/services')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminServiceController {
  constructor(
    private readonly serviceService: ServiceService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Permissions('service:create')
  @ApiOperation({ summary: 'Create a new service' })
  @ApiResponse({ status: 201, description: 'Service created successfully' })
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
  @ApiOperation({ summary: 'Get all services (Admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Returns paginated list of services' })
  findAll(
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
    @Query('activeOnly') activeOnly = false,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.serviceService.findAll(pageNum, limitNum, activeOnly);
  }

  @Get(':id')
  @Permissions('service:read')
  @ApiOperation({ summary: 'Get service by ID (Admin)' })
  @ApiParam({ name: 'id', description: 'Service ID' })
  @ApiResponse({ status: 200, description: 'Returns service details' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  findOne(@Param('id') id: string) {
    return this.serviceService.findById(id);
  }

  @Put(':id')
  @Permissions('service:update')
  @ApiOperation({ summary: 'Update service' })
  @ApiParam({ name: 'id', description: 'Service ID' })
  @ApiResponse({ status: 200, description: 'Service updated successfully' })
  @ApiResponse({ status: 404, description: 'Service not found' })
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
  @ApiOperation({ summary: 'Add document requirement to service' })
  @ApiParam({ name: 'id', description: 'Service ID' })
  @ApiParam({ name: 'docId', description: 'Document requirement ID' })
  @ApiQuery({ name: 'required', required: false, type: Boolean, example: true })
  @ApiResponse({ status: 200, description: 'Document requirement added successfully' })
  async addDocumentRequirement(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') serviceId: string,
    @Param('docId') documentRequirementId: string,
    @Query('required') requiredStr = 'true',
  ) {
    const required = requiredStr === 'true' || requiredStr === '1';
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
  @ApiOperation({ summary: 'Remove document requirement from service' })
  @ApiParam({ name: 'id', description: 'Service ID' })
  @ApiParam({ name: 'docId', description: 'Document requirement ID' })
  @ApiResponse({ status: 200, description: 'Document requirement removed successfully' })
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
  @ApiOperation({ summary: 'Add question to service' })
  @ApiParam({ name: 'id', description: 'Service ID' })
  @ApiParam({ name: 'questionId', description: 'Question ID' })
  @ApiQuery({ name: 'required', required: false, type: Boolean, example: true })
  @ApiQuery({ name: 'sortOrder', required: false, type: Number, example: 0 })
  @ApiResponse({ status: 200, description: 'Question added successfully' })
  async addQuestion(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') serviceId: string,
    @Param('questionId') questionId: string,
    @Query('required') requiredStr = 'true',
    @Query('sortOrder') sortOrderStr = '0',
  ) {
    const required = requiredStr === 'true' || requiredStr === '1';
    const sortOrder = parseInt(sortOrderStr, 10) || 0;
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
  @ApiOperation({ summary: 'Remove question from service' })
  @ApiParam({ name: 'id', description: 'Service ID' })
  @ApiParam({ name: 'questionId', description: 'Question ID' })
  @ApiResponse({ status: 200, description: 'Question removed successfully' })
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
