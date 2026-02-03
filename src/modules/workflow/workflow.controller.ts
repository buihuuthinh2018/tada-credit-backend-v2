import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/interfaces';

@Controller('admin/workflows')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Permissions('workflow:create')
  async create(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateWorkflowDto,
  ) {
    const result = await this.workflowService.create(dto);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'WORKFLOW_CREATED',
      targetType: 'workflow',
      targetId: result.id,
      metadata: { name: result.name, version: result.version },
    });

    return result;
  }

  @Get()
  @Permissions('workflow:read')
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.workflowService.findAll(page, limit);
  }

  @Get(':id')
  @Permissions('workflow:read')
  findOne(@Param('id') id: string) {
    return this.workflowService.findById(id);
  }

  @Put(':id')
  @Permissions('workflow:update')
  async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    const result = await this.workflowService.update(id, dto);
    
    await this.auditService.log({
      userId: admin.id,
      action: 'WORKFLOW_UPDATED',
      targetType: 'workflow',
      targetId: id,
      metadata: { changes: dto },
    });

    return result;
  }

  @Get(':id/stages')
  @Permissions('workflow:read')
  async getStages(@Param('id') id: string) {
    const workflow = await this.workflowService.findById(id);
    return workflow.stages;
  }

  @Get(':id/transitions')
  @Permissions('workflow:read')
  async getTransitions(@Param('id') id: string) {
    const workflow = await this.workflowService.findById(id);
    return workflow.transitions;
  }
}
