import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './dto';

@Injectable()
export class ServiceService {
  constructor(private readonly prisma: PrismaService) {}

  private formatService(service: any) {
    return {
      ...service,
      documentRequirements: (service.documents || []).map((d: any) => ({
        ...d.document_requirement,
        isRequired: d.is_required,
      })),
      questions: (service.questions || []).map((q: any) => ({
        ...q.question,
        isRequired: q.is_required,
        sortOrder: q.sort_order,
      })),
    };
  }

  async create(dto: CreateServiceDto) {
    // Verify workflow exists
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: dto.workflowId },
    });

    if (!workflow) {
      throw new BadRequestException('Workflow not found');
    }

    if (!workflow.is_active) {
      throw new BadRequestException('Cannot use inactive workflow');
    }

    return this.prisma.$transaction(async (tx) => {
      // Create service
      const service = await tx.service.create({
        data: {
          name: dto.name,
          description: dto.description,
          workflow_id: dto.workflowId,
          commission_enabled: dto.commissionEnabled ?? true,
          min_loan_amount: dto.minLoanAmount ?? 1000000,
          max_loan_amount: dto.maxLoanAmount ?? 100000000,
        },
      });

      // Add document requirements
      const documentRequirementInputs =
        dto.documentRequirements?.length
          ? dto.documentRequirements
          : dto.documentRequirementIds?.length
            ? dto.documentRequirementIds.map((id) => ({ id, isRequired: true }))
            : [];

      if (documentRequirementInputs.length) {
        const documentRequirementIds = documentRequirementInputs.map((d) => d.id);
        const docReqs = await tx.document_requirement.findMany({
          where: { id: { in: documentRequirementIds } },
        });

        if (docReqs.length !== documentRequirementIds.length) {
          throw new BadRequestException('Some document requirements not found');
        }

        await tx.service_document_requirement.createMany({
          data: documentRequirementInputs.map((d) => ({
            service_id: service.id,
            document_requirement_id: d.id,
            is_required: d.isRequired ?? true,
          })),
        });
      }

      // Add questions
      if (dto.questionIds?.length) {
        const questions = await tx.question.findMany({
          where: { id: { in: dto.questionIds } },
        });

        if (questions.length !== dto.questionIds.length) {
          throw new BadRequestException('Some questions not found');
        }

        await tx.service_question.createMany({
          data: dto.questionIds.map((qId, index) => ({
            service_id: service.id,
            question_id: qId,
            sort_order: index,
          })),
        });
      }

      // Important: query using the transaction client to ensure the just-created
      // record is visible before the transaction is committed.
      const fullService = await tx.service.findUnique({
        where: { id: service.id },
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
          questions: {
            include: {
              question: true,
            },
            orderBy: { sort_order: 'asc' },
          },
        },
      });

      if (!fullService) {
        throw new NotFoundException('Service not found');
      }

      return this.formatService(fullService);
    });
  }

  async findAll(page = 1, limit = 20, activeOnly = false) {
    const skip = (page - 1) * limit;
    const where = activeOnly ? { is_active: true } : {};

    const [data, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
              version: true,
            },
          },
          _count: {
            select: { documents: true, questions: true, contracts: true },
          },
        },
      }),
      this.prisma.service.count({ where }),
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
    const service = await this.prisma.service.findUnique({
      where: { id },
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
        questions: {
          include: {
            question: true,
          },
          orderBy: { sort_order: 'asc' },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return this.formatService(service);
  }

  async update(id: string, dto: UpdateServiceDto) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return this.prisma.service.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        is_active: dto.is_active,
        commission_enabled: dto.commission_enabled,
        min_loan_amount: dto.min_loan_amount,
        max_loan_amount: dto.max_loan_amount,
      },
    });
  }

  async addDocumentRequirement(serviceId: string, documentRequirementId: string, isRequired = true) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const docReq = await this.prisma.document_requirement.findUnique({
      where: { id: documentRequirementId },
    });
    if (!docReq) {
      throw new NotFoundException('Document requirement not found');
    }

    return this.prisma.service_document_requirement.create({
      data: {
        service_id: serviceId,
        document_requirement_id: documentRequirementId,
        is_required: isRequired,
      },
      include: {
        document_requirement: true,
      },
    });
  }

  async removeDocumentRequirement(serviceId: string, documentRequirementId: string) {
    const serviceDoc = await this.prisma.service_document_requirement.findFirst({
      where: {
        service_id: serviceId,
        document_requirement_id: documentRequirementId,
      },
    });

    if (!serviceDoc) {
      throw new NotFoundException('Document requirement not linked to this service');
    }

    await this.prisma.service_document_requirement.delete({
      where: { id: serviceDoc.id },
    });

    return { message: 'Document requirement removed from service' };
  }

  async addQuestion(serviceId: string, questionId: string, isRequired = true, sortOrder = 0) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return this.prisma.service_question.create({
      data: {
        service_id: serviceId,
        question_id: questionId,
        is_required: isRequired,
        sort_order: sortOrder,
      },
      include: {
        question: true,
      },
    });
  }

  async removeQuestion(serviceId: string, questionId: string) {
    const serviceQuestion = await this.prisma.service_question.findFirst({
      where: {
        service_id: serviceId,
        question_id: questionId,
      },
    });

    if (!serviceQuestion) {
      throw new NotFoundException('Question not linked to this service');
    }

    await this.prisma.service_question.delete({
      where: { id: serviceQuestion.id },
    });

    return { message: 'Question removed from service' };
  }

  async getActiveServices() {
    return this.prisma.service.findMany({
      where: { is_active: true },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            stages: {
              orderBy: { stage_order: 'asc' },
              select: {
                id: true,
                code: true,
                name: true,
                color: true,
                stage_order: true,
              },
            },
          },
        },
        _count: {
          select: { documents: true, questions: true },
        },
      },
    });
  }
}
