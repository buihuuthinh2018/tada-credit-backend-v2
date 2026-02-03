import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowService } from '../workflow/workflow.service';
import { CreateContractDto, SubmitContractDto, TransitionContractDto, AnswerDto } from './dto';
import { AuditService } from '../audit/audit.service';
import { CommissionService } from '../commission/commission.service';

@Injectable()
export class ContractService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: WorkflowService,
    private readonly auditService: AuditService,
    private readonly commissionService: CommissionService,
  ) {}

  async create(userId: string, dto: CreateContractDto) {
    // Get the service and its workflow
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
      include: {
        workflow: {
          include: {
            stages: {
              orderBy: { stage_order: 'asc' },
            },
          },
        },
        documents: {
          include: {
            document_requirement: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (!service.is_active) {
      throw new BadRequestException('Service is not active');
    }

    // Get the initial stage (first stage in order)
    const initialStage = service.workflow.stages[0];
    if (!initialStage) {
      throw new BadRequestException('Service workflow has no stages');
    }

    return this.prisma.$transaction(async (tx) => {
      // Create contract
      const contract = await tx.contract.create({
        data: {
          user_id: userId,
          service_id: dto.serviceId,
          current_stage_id: initialStage.id,
        },
      });

      // Create contract documents (empty, to be filled)
      const documentPromises = service.documents.map((doc) =>
        tx.contract_document.create({
          data: {
            contract_id: contract.id,
            document_requirement_id: doc.document_requirement_id,
          },
        }),
      );
      await Promise.all(documentPromises);

      // Save initial answers if provided
      if (dto.answers?.length) {
        const answerPromises = dto.answers.map((answer) =>
          tx.contract_answer.create({
            data: {
              contract_id: contract.id,
              question_id: answer.questionId,
              answer: answer.answer,
            },
          }),
        );
        await Promise.all(answerPromises);
      }

      // Log initial stage
      await tx.contract_stage_history.create({
        data: {
          contract_id: contract.id,
          to_stage_id: initialStage.id,
          changed_by: userId,
          metadata: { action: 'contract_created' },
        },
      });

      // Audit log
      await this.auditService.log({
        userId,
        action: 'CONTRACT_CREATED',
        targetType: 'contract',
        targetId: contract.id,
        metadata: { serviceId: dto.serviceId },
      });

      return this.findById(contract.id);
    });
  }

  async findById(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullname: true,
            phone: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            workflow_id: true,
          },
        },
        stage: true,
        documents: {
          include: {
            document_requirement: true,
            files: true,
          },
        },
        answers: {
          include: {
            question: true,
          },
        },
        histories: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    return contract;
  }

  async findByUser(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.contract.findMany({
        where: { user_id: userId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          service: {
            select: { id: true, name: true },
          },
          stage: true,
        },
      }),
      this.prisma.contract.count({ where: { user_id: userId } }),
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

  async findAll(page = 1, limit = 20, filters?: { serviceId?: string; stageId?: string }) {
    const skip = (page - 1) * limit;
    const where: { service_id?: string; current_stage_id?: string } = {};
    
    if (filters?.serviceId) where.service_id = filters.serviceId;
    if (filters?.stageId) where.current_stage_id = filters.stageId;

    const [data, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, fullname: true },
          },
          service: {
            select: { id: true, name: true },
          },
          stage: true,
        },
      }),
      this.prisma.contract.count({ where }),
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

  async updateAnswers(contractId: string, userId: string, answers: AnswerDto[]) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.user_id !== userId) {
      throw new ForbiddenException('Not authorized to update this contract');
    }

    return this.prisma.$transaction(async (tx) => {
      // Upsert answers
      for (const answer of answers) {
        await tx.contract_answer.upsert({
          where: {
            contract_id_question_id: {
              contract_id: contractId,
              question_id: answer.questionId,
            },
          },
          create: {
            contract_id: contractId,
            question_id: answer.questionId,
            answer: answer.answer,
          },
          update: {
            answer: answer.answer,
          },
        });
      }

      return this.findById(contractId);
    });
  }

  async transitionStage(contractId: string, dto: TransitionContractDto, actorId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        service: true,
        stage: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Validate transition
    await this.workflowService.validateTransition(
      contract.service.workflow_id,
      contract.current_stage_id,
      dto.toStageId,
      actorId,
    );

    // Get the target stage
    const toStage = await this.prisma.workflow_stage.findUnique({
      where: { id: dto.toStageId },
    });

    if (!toStage) {
      throw new BadRequestException('Target stage not found');
    }

    return this.prisma.$transaction(async (tx) => {
      // Update contract stage
      const updatedContract = await tx.contract.update({
        where: { id: contractId },
        data: { current_stage_id: dto.toStageId },
        include: {
          service: true,
          stage: true,
        },
      });

      // Record history
      await tx.contract_stage_history.create({
        data: {
          contract_id: contractId,
          from_stage_id: contract.current_stage_id,
          to_stage_id: dto.toStageId,
          changed_by: actorId,
          metadata: { note: dto.note },
        },
      });

      // Check if this is a completion stage (e.g., "COMPLETED" or "APPROVED")
      if (toStage.code === 'COMPLETED' || toStage.code === 'APPROVED') {
        await this.handleContractCompletion(contract.id, contract.user_id);
      }

      // Audit log
      await this.auditService.log({
        userId: actorId,
        action: 'CONTRACT_STAGE_CHANGED',
        targetType: 'contract',
        targetId: contractId,
        metadata: {
          fromStageId: contract.current_stage_id,
          fromStageCode: contract.stage.code,
          toStageId: dto.toStageId,
          toStageCode: toStage.code,
          note: dto.note,
        },
      });

      return this.findById(contractId);
    });
  }

  async getAvailableTransitions(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { service: true },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    return this.workflowService.getAvailableTransitions(
      contract.service.workflow_id,
      contract.current_stage_id,
    );
  }

  async getStageHistory(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    return this.prisma.contract_stage_history.findMany({
      where: { contract_id: contractId },
      orderBy: { created_at: 'desc' },
    });
  }

  async uploadDocument(
    contractId: string,
    documentRequirementId: string,
    fileUrl: string,
    fileName?: string,
    fileSize?: number,
    mimeType?: string,
  ) {
    const contractDoc = await this.prisma.contract_document.findFirst({
      where: {
        contract_id: contractId,
        document_requirement_id: documentRequirementId,
      },
    });

    if (!contractDoc) {
      throw new NotFoundException('Document requirement not found for this contract');
    }

    if (contractDoc.status !== 'PENDING') {
      throw new BadRequestException('Cannot upload to a reviewed document');
    }

    return this.prisma.contract_document_file.create({
      data: {
        contract_document_id: contractDoc.id,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
      },
    });
  }

  private async handleContractCompletion(contractId: string, userId: string) {
    // Trigger commission for referrer
    try {
      await this.commissionService.processContractCompletion(contractId, userId);
    } catch (error) {
      // Log but don't fail the transaction
      console.error('Failed to process commission:', error);
    }
  }
}
