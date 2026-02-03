import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto, UpdateQuestionDto } from './dto';

@Injectable()
export class QuestionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateQuestionDto) {
    return this.prisma.question.create({
      data: {
        content: dto.content,
        type: dto.type,
        config: dto.config,
      },
    });
  }

  async findAll(page = 1, limit = 20, activeOnly = false) {
    const skip = (page - 1) * limit;
    const where = activeOnly ? { is_active: true } : {};

    const [data, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.question.count({ where }),
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
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        _count: {
          select: { service_questions: true, contract_answers: true },
        },
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return question;
  }

  async update(id: string, dto: UpdateQuestionDto) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return this.prisma.question.update({
      where: { id },
      data: {
        content: dto.content,
        type: dto.type,
        config: dto.config,
        is_active: dto.isActive,
      },
    });
  }

  async delete(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: { _count: { select: { service_questions: true, contract_answers: true } } },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    if (question._count.service_questions > 0 || question._count.contract_answers > 0) {
      // Soft delete instead
      return this.prisma.question.update({
        where: { id },
        data: { is_active: false },
      });
    }

    return this.prisma.question.delete({ where: { id } });
  }
}
