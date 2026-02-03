import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto';
import { RbacService } from '../rbac/rbac.service';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
  ) {}

  async create(dto: CreateWorkflowDto) {
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
          version,
          is_active: true,
        },
      });

      // Create stages
      const stageMap = new Map<string, string>();
      for (const stageDto of dto.stages) {
        const stage = await tx.workflow_stage.create({
          data: {
            workflow_id: workflow.id,
            code: stageDto.code,
            name: stageDto.name,
            stage_order: stageDto.stageOrder,
          },
        });
        stageMap.set(stageDto.code, stage.id);
      }

      // Create transitions
      for (const transitionDto of dto.transitions) {
        const fromStageId = stageMap.get(transitionDto.fromStageCode);
        const toStageId = stageMap.get(transitionDto.toStageCode);

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

      // Deactivate previous versions
      if (latestWorkflow) {
        await tx.workflow.updateMany({
          where: { name: dto.name, id: { not: workflow.id } },
          data: { is_active: false },
        });
      }

      return this.findById(workflow.id);
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
        is_active: dto.isActive,
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
}
