import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentRequirementDto, UpdateDocumentRequirementDto } from './dto';
import { contract_document_status, Prisma } from '@prisma/client';

export interface DocumentConfig {
  maxFiles?: number;
  minFiles?: number;
  allowedTypes?: string[];
  maxSizeBytes?: number;
  expirationDays?: number;
}

@Injectable()
export class DocumentService {
  constructor(private readonly prisma: PrismaService) {}

  // Document Requirement Management
  async createRequirement(dto: CreateDocumentRequirementDto) {
    const existing = await this.prisma.document_requirement.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException('Document requirement code already exists');
    }

    return this.prisma.document_requirement.create({
      data: {
        code: dto.code.toUpperCase(),
        name: dto.name,
        version: 1,
        config: dto.config,
      },
    });
  }

  async findAllRequirements(page = 1, limit = 20, activeOnly = false) {
    const skip = (page - 1) * limit;
    const where = activeOnly ? { is_active: true } : {};

    const [data, total] = await Promise.all([
      this.prisma.document_requirement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.document_requirement.count({ where }),
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

  async findRequirementById(id: string) {
    const requirement = await this.prisma.document_requirement.findUnique({
      where: { id },
      include: {
        _count: {
          select: { service_requirements: true, contract_documents: true },
        },
      },
    });

    if (!requirement) {
      throw new NotFoundException('Document requirement not found');
    }

    return requirement;
  }

  async updateRequirement(id: string, dto: UpdateDocumentRequirementDto) {
    const requirement = await this.prisma.document_requirement.findUnique({ where: { id } });
    if (!requirement) {
      throw new NotFoundException('Document requirement not found');
    }

    // If config is updated, increment version
    const updateData: {
      name?: string;
      config?: Prisma.InputJsonValue;
      is_active?: boolean;
      version?: number;
    } = {};
    
    if (dto.name) updateData.name = dto.name;
    if (dto.isActive !== undefined) updateData.is_active = dto.isActive;
    if (dto.config) {
      updateData.config = dto.config as Prisma.InputJsonValue;
      updateData.version = requirement.version + 1;
    }

    return this.prisma.document_requirement.update({
      where: { id },
      data: updateData,
    });
  }

  // Contract Document Management
  async reviewDocument(
    documentId: string,
    status: contract_document_status,
    reviewNote?: string,
    reviewerId?: string,
  ) {
    const document = await this.prisma.contract_document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.status !== 'PENDING') {
      throw new BadRequestException('Document has already been reviewed');
    }

    return this.prisma.contract_document.update({
      where: { id: documentId },
      data: {
        status,
        review_note: reviewNote,
        reviewed_by: reviewerId,
      },
      include: {
        document_requirement: true,
        files: true,
      },
    });
  }

  async validateDocumentFiles(
    documentRequirementId: string,
    files: { fileName: string; fileSize: number; mimeType: string }[],
  ) {
    const requirement = await this.prisma.document_requirement.findUnique({
      where: { id: documentRequirementId },
    });

    if (!requirement) {
      throw new NotFoundException('Document requirement not found');
    }

    const config = requirement.config as DocumentConfig;
    const errors: string[] = [];

    // Check file count
    if (config.minFiles && files.length < config.minFiles) {
      errors.push(`Minimum ${config.minFiles} files required`);
    }
    if (config.maxFiles && files.length > config.maxFiles) {
      errors.push(`Maximum ${config.maxFiles} files allowed`);
    }

    // Check each file
    for (const file of files) {
      if (config.allowedTypes && !config.allowedTypes.includes(file.mimeType)) {
        errors.push(`File type ${file.mimeType} is not allowed for ${file.fileName}`);
      }
      if (config.maxSizeBytes && file.fileSize > config.maxSizeBytes) {
        errors.push(`File ${file.fileName} exceeds maximum size of ${config.maxSizeBytes} bytes`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async getContractDocuments(contractId: string) {
    return this.prisma.contract_document.findMany({
      where: { contract_id: contractId },
      include: {
        document_requirement: true,
        files: true,
      },
    });
  }

  async addFileToDocument(
    documentId: string,
    fileUrl: string,
    fileName?: string,
    fileSize?: number,
    mimeType?: string,
  ) {
    const document = await this.prisma.contract_document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return this.prisma.contract_document_file.create({
      data: {
        contract_document_id: documentId,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
      },
    });
  }

  async deleteFile(fileId: string) {
    const file = await this.prisma.contract_document_file.findUnique({
      where: { id: fileId },
      include: {
        document: true,
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.document.status !== 'PENDING') {
      throw new BadRequestException('Cannot delete file from reviewed document');
    }

    await this.prisma.contract_document_file.delete({
      where: { id: fileId },
    });

    return { message: 'File deleted successfully' };
  }
}
