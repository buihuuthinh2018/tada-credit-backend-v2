import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkflowDto, UpdateWorkflowDto, CreateStageDto, UpdateStageDto, CreateTransitionDto, UpdateTransitionDto } from './dto';
import { RbacService } from '../rbac/rbac.service';

// Required stage codes that must exist in every workflow
const REQUIRED_STAGE_CODES = ['DRAFT', 'SUBMITTED', 'COMPLETED'];

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
  ) {}

  /**
   * Get default stages with required stages marked
   */
  getDefaultStages() {
    return [
      { code: 'DRAFT', name: 'Nháp', stageOrder: 0, color: '#6B7280', isRequired: true, triggersCommission: false },
      { code: 'SUBMITTED', name: 'Đã nộp', stageOrder: 1, color: '#F59E0B', isRequired: true, triggersCommission: false },
      { code: 'REVIEWING', name: 'Đang xem xét', stageOrder: 2, color: '#3B82F6', isRequired: false, triggersCommission: false },
      { code: 'APPROVED', name: 'Đã duyệt', stageOrder: 3, color: '#10B981', isRequired: false, triggersCommission: false },
      { code: 'DISBURSED', name: 'Đã giải ngân', stageOrder: 4, color: '#8B5CF6', isRequired: false, triggersCommission: false },
      { code: 'COMPLETED', name: 'Hoàn thành', stageOrder: 5, color: '#22C55E', isRequired: true, triggersCommission: true },
      { code: 'REJECTED', name: 'Từ chối', stageOrder: 6, color: '#EF4444', isRequired: false, triggersCommission: false },
    ];
  }

  /**
   * Validate that required stages exist
   */
  private validateRequiredStages(stages: { code: string }[]) {
    const stageCodes = stages.map(s => s.code.toUpperCase());
    const missingStages = REQUIRED_STAGE_CODES.filter(code => !stageCodes.includes(code));
    
    if (missingStages.length > 0) {
      throw new BadRequestException(
        `Workflow must include required stages: ${missingStages.join(', ')}. These stages are mandatory for proper contract flow.`
      );
    }
  }

  async create(dto: CreateWorkflowDto) {
    // Validate required stages if stages are provided
    if (dto.stages && dto.stages.length > 0) {
      this.validateRequiredStages(dto.stages);
    }

    // Get the latest version for this workflow name
    const latestWorkflow = await this.prisma.workflow.findFirst({
      where: { name: dto.name },
      orderBy: { version: 'desc' },
    });

    const version = latestWorkflow ? latestWorkflow.version + 1 : 1;

    // Create workflow with stages and transitions in a transaction
    return this.prisma.$transaction(async (tx) => {
      // Create the workflow
      const workflow = await tx.workflow.create({
        data: {
          name: dto.name,
          description: dto.description || null,
          version,
          is_active: true,
        },
      });

      // Create stages if provided
      const stageMap = new Map<string, string>();
      if (dto.stages && dto.stages.length > 0) {
        for (const stageDto of dto.stages) {
          const isRequiredStage = REQUIRED_STAGE_CODES.includes(stageDto.code.toUpperCase());
          const stage = await tx.workflow_stage.create({
            data: {
              workflow_id: workflow.id,
              code: stageDto.code.toUpperCase(),
              name: stageDto.name,
              stage_order: stageDto.stageOrder,
              color: stageDto.color || '#6B7280',
              is_required: isRequiredStage || stageDto.isRequired || false,
              triggers_commission: stageDto.triggersCommission || false,
            },
          });
          stageMap.set(stageDto.code.toUpperCase(), stage.id);
        }
      }

      // Create transitions if provided
      if (dto.transitions && dto.transitions.length > 0) {
        for (const transitionDto of dto.transitions) {
          const fromStageId = stageMap.get(transitionDto.fromStageCode.toUpperCase());
          const toStageId = stageMap.get(transitionDto.toStageCode.toUpperCase());

          if (!fromStageId || !toStageId) {
            throw new BadRequestException(
              `Invalid stage code in transition: ${transitionDto.fromStageCode} -> ${transitionDto.toStageCode}`,
            );
          }

          await tx.workflow_transition.create({
            data: {
              workflow_id: workflow.id,
              from_stage_id: fromStageId,
              to_stage_id: toStageId,
              required_permission: transitionDto.requiredPermission,
            },
          });
        }
      }

      // Deactivate previous versions
      if (latestWorkflow) {
        await tx.workflow.updateMany({
          where: { name: dto.name, id: { not: workflow.id } },
          data: { is_active: false },
        });
      }

      // Return workflow with stages and transitions using transaction context
      return tx.workflow.findUnique({
        where: { id: workflow.id },
        include: {
          stages: {
            orderBy: { stage_order: 'asc' },
          },
          transitions: {
            include: {
              from_stage: true,
              to_stage: true,
            },
          },
        },
      });
    });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.workflow.findMany({
        skip,
        take: limit,
        orderBy: [{ name: 'asc' }, { version: 'desc' }],
        include: {
          _count: {
            select: { stages: true, transitions: true, services: true },
          },
        },
      }),
      this.prisma.workflow.count(),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findById(id: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { stage_order: 'asc' },
        },
        transitions: {
          include: {
            from_stage: true,
            to_stage: true,
          },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    return workflow;
  }

  async findActiveByName(name: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { name, is_active: true },
      include: {
        stages: {
          orderBy: { stage_order: 'asc' },
        },
        transitions: {
          include: {
            from_stage: true,
            to_stage: true,
          },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException('Active workflow not found');
    }

    return workflow;
  }

  async update(id: string, dto: UpdateWorkflowDto) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id } });
    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    return this.prisma.workflow.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        is_active: dto.is_active,
      },
    });
  }

  async getInitialStage(workflowId: string) {
    const stage = await this.prisma.workflow_stage.findFirst({
      where: { workflow_id: workflowId },
      orderBy: { stage_order: 'asc' },
    });

    if (!stage) {
      throw new NotFoundException('Workflow has no stages');
    }

    return stage;
  }

  async getAvailableTransitions(workflowId: string, currentStageId: string) {
    return this.prisma.workflow_transition.findMany({
      where: {
        workflow_id: workflowId,
        from_stage_id: currentStageId,
      },
      include: {
        to_stage: true,
      },
    });
  }

  async canTransition(
    workflowId: string,
    fromStageId: string,
    toStageId: string,
    userId: string,
  ): Promise<{ canTransition: boolean; reason?: string }> {
    const transition = await this.prisma.workflow_transition.findFirst({
      where: {
        workflow_id: workflowId,
        from_stage_id: fromStageId,
        to_stage_id: toStageId,
      },
    });

    if (!transition) {
      return { canTransition: false, reason: 'Invalid transition' };
    }

    // Check permission if required
    if (transition.required_permission) {
      const hasPermission = await this.rbacService.hasPermission(
        userId,
        transition.required_permission,
      );
      if (!hasPermission) {
        return {
          canTransition: false,
          reason: `Missing permission: ${transition.required_permission}`,
        };
      }
    }

    return { canTransition: true };
  }

  async validateTransition(
    workflowId: string,
    fromStageId: string,
    toStageId: string,
    userId: string,
  ) {
    const result = await this.canTransition(workflowId, fromStageId, toStageId, userId);
    
    if (!result.canTransition) {
      throw new ForbiddenException(result.reason);
    }
  }

  async getStageByCode(workflowId: string, stageCode: string) {
    const stage = await this.prisma.workflow_stage.findFirst({
      where: {
        workflow_id: workflowId,
        code: stageCode,
      },
    });

    if (!stage) {
      throw new NotFoundException(`Stage with code '${stageCode}' not found`);
    }

    return stage;
  }

  // ==================== STAGE CRUD ====================
  
  async createStage(workflowId: string, dto: CreateStageDto) {
    // Check workflow exists
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    // Check if code already exists in this workflow
    const existingStage = await this.prisma.workflow_stage.findFirst({
      where: { workflow_id: workflowId, code: dto.code },
    });
    if (existingStage) {
      throw new BadRequestException(`Stage with code '${dto.code}' already exists in this workflow`);
    }

    return this.prisma.workflow_stage.create({
      data: {
        workflow_id: workflowId,
        code: dto.code,
        name: dto.name,
        stage_order: dto.stageOrder,
        color: dto.color || '#6B7280',
      },
    });
  }

  async updateStage(workflowId: string, stageId: string, dto: UpdateStageDto) {
    // Check stage exists
    const stage = await this.prisma.workflow_stage.findFirst({
      where: { id: stageId, workflow_id: workflowId },
    });
    if (!stage) {
      throw new NotFoundException('Stage not found');
    }

    // Check if new code already exists (if code is being changed)
    if (dto.code && dto.code !== stage.code) {
      const existingStage = await this.prisma.workflow_stage.findFirst({
        where: { workflow_id: workflowId, code: dto.code },
      });
      if (existingStage) {
        throw new BadRequestException(`Stage with code '${dto.code}' already exists in this workflow`);
      }
    }

    return this.prisma.workflow_stage.update({
      where: { id: stageId },
      data: {
        code: dto.code,
        name: dto.name,
        stage_order: dto.stageOrder,
        color: dto.color,
      },
    });
  }

  async deleteStage(workflowId: string, stageId: string) {
    // Check stage exists
    const stage = await this.prisma.workflow_stage.findFirst({
      where: { id: stageId, workflow_id: workflowId },
    });
    if (!stage) {
      throw new NotFoundException('Stage not found');
    }

    // Check if stage is used in any contract
    const contractsUsingStage = await this.prisma.contract.count({
      where: { current_stage_id: stageId },
    });
    if (contractsUsingStage > 0) {
      throw new BadRequestException(`Cannot delete stage: ${contractsUsingStage} contract(s) are using this stage`);
    }

    // Delete related transitions first
    await this.prisma.workflow_transition.deleteMany({
      where: {
        OR: [{ from_stage_id: stageId }, { to_stage_id: stageId }],
      },
    });

    // Delete the stage
    return this.prisma.workflow_stage.delete({ where: { id: stageId } });
  }

  // ==================== TRANSITION CRUD ====================

  async createTransition(workflowId: string, dto: CreateTransitionDto) {
    // Check workflow exists
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    // Check both stages exist and belong to this workflow
    const [fromStage, toStage] = await Promise.all([
      this.prisma.workflow_stage.findFirst({ where: { id: dto.fromStageId, workflow_id: workflowId } }),
      this.prisma.workflow_stage.findFirst({ where: { id: dto.toStageId, workflow_id: workflowId } }),
    ]);

    if (!fromStage) {
      throw new BadRequestException('From stage not found in this workflow');
    }
    if (!toStage) {
      throw new BadRequestException('To stage not found in this workflow');
    }

    // Check if transition already exists
    const existingTransition = await this.prisma.workflow_transition.findFirst({
      where: {
        workflow_id: workflowId,
        from_stage_id: dto.fromStageId,
        to_stage_id: dto.toStageId,
      },
    });
    if (existingTransition) {
      throw new BadRequestException('This transition already exists');
    }

    return this.prisma.workflow_transition.create({
      data: {
        workflow_id: workflowId,
        from_stage_id: dto.fromStageId,
        to_stage_id: dto.toStageId,
        required_permission: dto.requiredPermission,
      },
      include: {
        from_stage: true,
        to_stage: true,
      },
    });
  }

  async updateTransition(workflowId: string, transitionId: string, dto: UpdateTransitionDto) {
    // Check transition exists
    const transition = await this.prisma.workflow_transition.findFirst({
      where: { id: transitionId, workflow_id: workflowId },
    });
    if (!transition) {
      throw new NotFoundException('Transition not found');
    }

    // Check if new stages exist (if being changed)
    if (dto.fromStageId) {
      const fromStage = await this.prisma.workflow_stage.findFirst({
        where: { id: dto.fromStageId, workflow_id: workflowId },
      });
      if (!fromStage) {
        throw new BadRequestException('From stage not found in this workflow');
      }
    }
    if (dto.toStageId) {
      const toStage = await this.prisma.workflow_stage.findFirst({
        where: { id: dto.toStageId, workflow_id: workflowId },
      });
      if (!toStage) {
        throw new BadRequestException('To stage not found in this workflow');
      }
    }

    return this.prisma.workflow_transition.update({
      where: { id: transitionId },
      data: {
        from_stage_id: dto.fromStageId,
        to_stage_id: dto.toStageId,
        required_permission: dto.requiredPermission,
      },
      include: {
        from_stage: true,
        to_stage: true,
      },
    });
  }

  async deleteTransition(workflowId: string, transitionId: string) {
    // Check transition exists
    const transition = await this.prisma.workflow_transition.findFirst({
      where: { id: transitionId, workflow_id: workflowId },
    });
    if (!transition) {
      throw new NotFoundException('Transition not found');
    }

    return this.prisma.workflow_transition.delete({ where: { id: transitionId } });
  }
}
