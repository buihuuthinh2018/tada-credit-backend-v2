import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { WorkflowService } from './workflow.service';
import { CreateWorkflowDto, UpdateWorkflowDto, CreateStageDto, UpdateStageDto, CreateTransitionDto, UpdateTransitionDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/interfaces';

@ApiTags('Workflows')
@ApiBearerAuth('JWT-auth')
@Controller('admin/workflows')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Permissions('workflow:create')
  @ApiOperation({ 
    summary: 'Create a new workflow with stages and transitions',
    description: `Creates a workflow with optional stages and transitions.
    
**Basic workflow creation (no stages):**
\`\`\`json
{
  "name": "My Workflow",
  "description": "Optional description"
}
\`\`\`

**Full workflow creation with stages and transitions:**
\`\`\`json
{
  "name": "Credit Approval Workflow",
  "description": "Workflow for credit approval process",
  "stages": [
    { "code": "DRAFT", "name": "Nháp", "stageOrder": 0, "color": "#6B7280" },
    { "code": "REVIEWING", "name": "Đang xem xét", "stageOrder": 1, "color": "#3B82F6" },
    { "code": "APPROVED", "name": "Đã duyệt", "stageOrder": 2, "color": "#10B981" }
  ],
  "transitions": [
    { "fromStageCode": "DRAFT", "toStageCode": "REVIEWING", "requiredPermission": "contract:submit" },
    { "fromStageCode": "REVIEWING", "toStageCode": "APPROVED", "requiredPermission": "contract:approve" }
  ]
}
\`\`\`
    `
  })
  @ApiResponse({ status: 201, description: 'Workflow created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid stage code in transition' })
  async create(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateWorkflowDto,
  ) {
    const result = await this.workflowService.create(dto);
    
    if (result) {
      await this.auditService.log({
        userId: admin.id,
        action: 'WORKFLOW_CREATED',
        targetType: 'workflow',
        targetId: result.id,
        metadata: { name: result.name, version: result.version },
      });
    }

    return result;
  }

  @Get()
  @Permissions('workflow:read')
  @ApiOperation({ summary: 'Get all workflows' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Returns paginated list of workflows' })
  findAll(
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 20,
  ) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    return this.workflowService.findAll(pageNum, limitNum);
  }

  @Get(':id')
  @Permissions('workflow:read')
  @ApiOperation({ summary: 'Get workflow by ID with stages and transitions' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 200, description: 'Returns workflow details' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  findOne(@Param('id') id: string) {
    return this.workflowService.findById(id);
  }

  @Put(':id')
  @Permissions('workflow:update')
  @ApiOperation({ summary: 'Update workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 200, description: 'Workflow updated successfully' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
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
  @ApiOperation({ summary: 'Get all stages of a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 200, description: 'Returns list of workflow stages' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async getStages(@Param('id') id: string) {
    const workflow = await this.workflowService.findById(id);
    return workflow.stages;
  }

  @Get(':id/transitions')
  @Permissions('workflow:read')
  @ApiOperation({ summary: 'Get all transitions of a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 200, description: 'Returns list of workflow transitions' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async getTransitions(@Param('id') id: string) {
    const workflow = await this.workflowService.findById(id);
    return workflow.transitions;
  }

  // ==================== STAGE CRUD ====================

  @Post(':id/stages')
  @Permissions('workflow:update')
  @ApiOperation({ summary: 'Create a new stage in a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 201, description: 'Stage created successfully' })
  @ApiResponse({ status: 400, description: 'Stage code already exists' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async createStage(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateStageDto,
  ) {
    const result = await this.workflowService.createStage(id, dto);

    await this.auditService.log({
      userId: admin.id,
      action: 'WORKFLOW_STAGE_CREATED',
      targetType: 'workflow_stage',
      targetId: result.id,
      metadata: { workflowId: id, code: dto.code, name: dto.name },
    });

    return result;
  }

  @Put(':id/stages/:stageId')
  @Permissions('workflow:update')
  @ApiOperation({ summary: 'Update a stage in a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiParam({ name: 'stageId', description: 'Stage ID' })
  @ApiResponse({ status: 200, description: 'Stage updated successfully' })
  @ApiResponse({ status: 404, description: 'Stage not found' })
  async updateStage(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Param('stageId') stageId: string,
    @Body() dto: UpdateStageDto,
  ) {
    const result = await this.workflowService.updateStage(id, stageId, dto);

    await this.auditService.log({
      userId: admin.id,
      action: 'WORKFLOW_STAGE_UPDATED',
      targetType: 'workflow_stage',
      targetId: stageId,
      metadata: { workflowId: id, changes: dto },
    });

    return result;
  }

  @Delete(':id/stages/:stageId')
  @Permissions('workflow:update')
  @ApiOperation({ summary: 'Delete a stage from a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiParam({ name: 'stageId', description: 'Stage ID' })
  @ApiResponse({ status: 200, description: 'Stage deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete stage in use' })
  @ApiResponse({ status: 404, description: 'Stage not found' })
  async deleteStage(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Param('stageId') stageId: string,
  ) {
    const result = await this.workflowService.deleteStage(id, stageId);

    await this.auditService.log({
      userId: admin.id,
      action: 'WORKFLOW_STAGE_DELETED',
      targetType: 'workflow_stage',
      targetId: stageId,
      metadata: { workflowId: id },
    });

    return result;
  }

  // ==================== TRANSITION CRUD ====================

  @Post(':id/transitions')
  @Permissions('workflow:update')
  @ApiOperation({ summary: 'Create a new transition in a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 201, description: 'Transition created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid stage or transition already exists' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async createTransition(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateTransitionDto,
  ) {
    const result = await this.workflowService.createTransition(id, dto);

    await this.auditService.log({
      userId: admin.id,
      action: 'WORKFLOW_TRANSITION_CREATED',
      targetType: 'workflow_transition',
      targetId: result.id,
      metadata: { workflowId: id, fromStageId: dto.fromStageId, toStageId: dto.toStageId },
    });

    return result;
  }

  @Put(':id/transitions/:transitionId')
  @Permissions('workflow:update')
  @ApiOperation({ summary: 'Update a transition in a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiParam({ name: 'transitionId', description: 'Transition ID' })
  @ApiResponse({ status: 200, description: 'Transition updated successfully' })
  @ApiResponse({ status: 404, description: 'Transition not found' })
  async updateTransition(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Param('transitionId') transitionId: string,
    @Body() dto: UpdateTransitionDto,
  ) {
    const result = await this.workflowService.updateTransition(id, transitionId, dto);

    await this.auditService.log({
      userId: admin.id,
      action: 'WORKFLOW_TRANSITION_UPDATED',
      targetType: 'workflow_transition',
      targetId: transitionId,
      metadata: { workflowId: id, changes: dto },
    });

    return result;
  }

  @Delete(':id/transitions/:transitionId')
  @Permissions('workflow:update')
  @ApiOperation({ summary: 'Delete a transition from a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiParam({ name: 'transitionId', description: 'Transition ID' })
  @ApiResponse({ status: 200, description: 'Transition deleted successfully' })
  @ApiResponse({ status: 404, description: 'Transition not found' })
  async deleteTransition(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Param('transitionId') transitionId: string,
  ) {
    const result = await this.workflowService.deleteTransition(id, transitionId);

    await this.auditService.log({
      userId: admin.id,
      action: 'WORKFLOW_TRANSITION_DELETED',
      targetType: 'workflow_transition',
      targetId: transitionId,
      metadata: { workflowId: id },
    });

    return result;
  }
}
