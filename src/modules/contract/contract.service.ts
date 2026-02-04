import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowService } from '../workflow/workflow.service';
import { CreateContractDto, SubmitContractDto, TransitionContractDto, AnswerDto } from './dto';
import { AuditService } from '../audit/audit.service';
import { CommissionService } from '../commission/commission.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ContractService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: WorkflowService,
    private readonly auditService: AuditService,
    private readonly commissionService: CommissionService,
    private readonly storageService: StorageService,
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
      // Generate contract number: HD-YYYY-NNNNNN
      const year = new Date().getFullYear();
      const lastContract = await tx.contract.findFirst({
        where: {
          contract_number: {
            startsWith: `HD-${year}-`,
          },
        },
        orderBy: { created_at: 'desc' },
      });
      
      let sequence = 1;
      if (lastContract?.contract_number) {
        const lastNum = parseInt(lastContract.contract_number.split('-')[2], 10);
        sequence = isNaN(lastNum) ? 1 : lastNum + 1;
      }
      const contractNumber = `HD-${year}-${sequence.toString().padStart(6, '0')}`;

      // Create contract
      const contract = await tx.contract.create({
        data: {
          contract_number: contractNumber,
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

      // Fetch complete contract data within transaction
      const createdContract = await tx.contract.findUnique({
        where: { id: contract.id },
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
            include: {
              questions: {
                include: {
                  question: true,
                },
                orderBy: { sort_order: 'asc' },
              },
              documents: {
                include: {
                  document_requirement: true,
                },
              },
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

      if (!createdContract) {
        throw new Error('Failed to create contract');
      }

      // Transform service data to match frontend expectations
      const transformedContract = {
        ...createdContract,
        service: createdContract.service ? {
          id: createdContract.service.id,
          name: createdContract.service.name,
          description: createdContract.service.description,
          isActive: createdContract.service.is_active,
          createdAt: createdContract.service.created_at,
          questions: createdContract.service.questions?.map(sq => ({
            ...sq.question,
            order: sq.sort_order,
            isRequired: sq.is_required,
          })) || [],
          documentRequirements: createdContract.service.documents?.map(sd => ({
            ...sd.document_requirement,
            isRequired: sd.is_required,
          })) || [],
        } : undefined,
      };

      return transformedContract;
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
          include: {
            questions: {
              include: {
                question: true,
              },
              orderBy: { sort_order: 'asc' },
            },
            documents: {
              include: {
                document_requirement: true,
              },
            },
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

    // Transform service data to match frontend expectations
    return {
      ...contract,
      service: contract.service ? {
        id: contract.service.id,
        name: contract.service.name,
        description: contract.service.description,
        isActive: contract.service.is_active,
        createdAt: contract.service.created_at,
        questions: contract.service.questions?.map(sq => ({
          ...sq.question,
          order: sq.sort_order,
          isRequired: sq.is_required,
        })) || [],
        documentRequirements: contract.service.documents?.map(sd => ({
          ...sd.document_requirement,
          isRequired: sd.is_required,
        })) || [],
      } : undefined,
    };
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

  async findAll(page = 1, limit = 20, filters?: { 
    serviceId?: string; 
    stageId?: string;
    search?: string;  // Search by email, phone, fullname, contract_number
  }) {
    const skip = (page - 1) * limit;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    
    if (filters?.serviceId) where.service_id = filters.serviceId;
    if (filters?.stageId) where.current_stage_id = filters.stageId;
    
    // Search across multiple fields (MySQL uses case-insensitive LIKE by default)
    if (filters?.search) {
      const searchTerm = filters.search.trim();
      where.OR = [
        { contract_number: { contains: searchTerm } },
        { user: { email: { contains: searchTerm } } },
        { user: { phone: { contains: searchTerm } } },
        { user: { fullname: { contains: searchTerm } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, fullname: true, phone: true },
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

      // Check if this stage triggers commission (dynamic based on workflow config)
      if (toStage.triggers_commission) {
        await this.handleContractCompletion(contract.id, contract.user_id, dto.disbursementAmount);
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
          triggersCommission: toStage.triggers_commission,
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

  /**
   * Upload multiple files for a contract document requirement
   * Files are uploaded to R2 Storage
   */
  async uploadDocuments(
    contractId: string,
    documentRequirementId: string,
    files: Express.Multer.File[],
    userId: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    // Validate contract exists and belongs to user
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.user_id !== userId) {
      throw new ForbiddenException('Not authorized to upload to this contract');
    }

    // Find the contract document
    const contractDoc = await this.prisma.contract_document.findFirst({
      where: {
        contract_id: contractId,
        document_requirement_id: documentRequirementId,
      },
      include: {
        document_requirement: true,
        files: true,
      },
    });

    if (!contractDoc) {
      throw new NotFoundException('Document requirement not found for this contract');
    }

    if (contractDoc.status !== 'PENDING') {
      throw new BadRequestException('Cannot upload to a reviewed document');
    }

    // Check max files limit from document requirement config
    const config = contractDoc.document_requirement.config as { maxFiles?: number; allowedTypes?: string[]; maxSizeBytes?: number } | null;
    const maxFiles = config?.maxFiles || 5;
    const currentFileCount = contractDoc.files.length;

    if (currentFileCount + files.length > maxFiles) {
      throw new BadRequestException(
        `Maximum ${maxFiles} files allowed. Currently have ${currentFileCount} files.`,
      );
    }

    // Upload files to R2 Storage
    const folder = this.storageService.generateContractDocumentPath(contractId, documentRequirementId);
    const uploadedFiles = await this.storageService.uploadFiles(files, {
      folder,
      allowedMimeTypes: config?.allowedTypes,
      maxSizeBytes: config?.maxSizeBytes,
    });

    // Save file records to database
    const createdFiles = await Promise.all(
      uploadedFiles.map((uploadResult) =>
        this.prisma.contract_document_file.create({
          data: {
            contract_document_id: contractDoc.id,
            file_url: uploadResult.url,
            file_name: uploadResult.fileName,
            file_size: uploadResult.fileSize,
            mime_type: uploadResult.mimeType,
          },
        }),
      ),
    );

    // Audit log
    await this.auditService.log({
      userId,
      action: 'CONTRACT_DOCUMENT_UPLOADED',
      targetType: 'contract_document',
      targetId: contractDoc.id,
      metadata: {
        contractId,
        documentRequirementId,
        filesCount: files.length,
        fileNames: uploadedFiles.map((f) => f.fileName),
      },
    });

    return {
      message: 'Files uploaded successfully',
      files: createdFiles,
    };
  }

  /**
   * Submit contract with answers and all document files at once.
   * This is the deferred upload approach - files are only uploaded when user clicks submit.
   */
  async submitContract(
    contractId: string,
    userId: string,
    answers: AnswerDto[],
    filesByDocReq: Record<string, Express.Multer.File[]>,
  ) {
    // Validate contract exists and belongs to user
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        service: {
          include: {
            workflow: {
              include: {
                stages: { orderBy: { stage_order: 'asc' } },
              },
            },
            documents: {
              include: { document_requirement: true },
            },
          },
        },
        stage: true,
        documents: {
          include: {
            document_requirement: true,
            files: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.user_id !== userId) {
      throw new ForbiddenException('Not authorized to submit this contract');
    }

    // Only allow submit from DRAFT stage
    if (contract.stage.code !== 'DRAFT') {
      throw new BadRequestException('Contract has already been submitted');
    }

    // Validate required documents
    for (const serviceDoc of contract.service.documents) {
      if (!serviceDoc.is_required) continue;
      
      const contractDoc = contract.documents.find(
        (d) => d.document_requirement_id === serviceDoc.document_requirement_id
      );
      const existingFiles = contractDoc?.files?.length || 0;
      const newFiles = filesByDocReq[serviceDoc.document_requirement_id]?.length || 0;
      
      if (existingFiles + newFiles === 0) {
        throw new BadRequestException(
          `Missing required document: ${serviceDoc.document_requirement.name}`
        );
      }
    }

    // Find next stage after DRAFT
    const stages = contract.service.workflow.stages;
    const currentStageIndex = stages.findIndex((s) => s.id === contract.current_stage_id);
    const nextStage = stages[currentStageIndex + 1];

    if (!nextStage) {
      throw new BadRequestException('No next stage available in workflow');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Save/update answers
      if (answers.length > 0) {
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
      }

      // 2. Upload files for each document requirement
      for (const [docReqId, files] of Object.entries(filesByDocReq)) {
        if (files.length === 0) continue;

        const contractDoc = await tx.contract_document.findFirst({
          where: {
            contract_id: contractId,
            document_requirement_id: docReqId,
          },
          include: { document_requirement: true },
        });

        if (!contractDoc) {
          throw new NotFoundException(`Document requirement ${docReqId} not found for this contract`);
        }

        // Upload files to R2 Storage
        const folder = this.storageService.generateContractDocumentPath(contractId, docReqId);
        const config = contractDoc.document_requirement.config as { allowedTypes?: string[]; maxSizeBytes?: number } | null;
        
        const uploadedFiles = await this.storageService.uploadFiles(files, {
          folder,
          allowedMimeTypes: config?.allowedTypes,
          maxSizeBytes: config?.maxSizeBytes,
        });

        // Save file records to database
        for (const uploadResult of uploadedFiles) {
          await tx.contract_document_file.create({
            data: {
              contract_document_id: contractDoc.id,
              file_url: uploadResult.url,
              file_name: uploadResult.fileName,
              file_size: uploadResult.fileSize,
              mime_type: uploadResult.mimeType,
            },
          });
        }
      }

      // 3. Transition to next stage
      await tx.contract.update({
        where: { id: contractId },
        data: {
          current_stage_id: nextStage.id,
        },
      });

      // 4. Record history
      await tx.contract_stage_history.create({
        data: {
          contract_id: contractId,
          from_stage_id: contract.current_stage_id,
          to_stage_id: nextStage.id,
          changed_by: userId,
          metadata: { action: 'contract_submitted' },
        },
      });

      // Audit log
      await this.auditService.log({
        userId,
        action: 'CONTRACT_SUBMITTED',
        targetType: 'contract',
        targetId: contractId,
        metadata: {
          fromStage: contract.stage.code,
          toStage: nextStage.code,
          answersCount: answers.length,
          filesCount: Object.values(filesByDocReq).reduce((sum, f) => sum + f.length, 0),
        },
      });

      return this.findById(contractId);
    });
  }

  private async handleContractCompletion(contractId: string, userId: string, disbursementAmount?: number) {
    // Trigger commission for referrer
    try {
      await this.commissionService.processContractCompletion(contractId, userId, disbursementAmount);
    } catch (error) {
      // Log but don't fail the transaction
      console.error('Failed to process commission:', error);
    }
  }
}
