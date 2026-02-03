import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { AuditService } from '../audit/audit.service';
import { CreateWithdrawalDto, ProcessWithdrawalDto } from './dto';
import { withdrawal_status, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class WithdrawalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly auditService: AuditService,
  ) {}

  async createRequest(userId: string, dto: CreateWithdrawalDto) {
    // Get user's wallet and check balance
    const wallet = await this.walletService.getWalletByUserId(userId);
    const requestAmount = new Decimal(dto.amount);

    if (wallet.balance.lessThan(requestAmount)) {
      throw new BadRequestException('Insufficient balance');
    }

    // Check for pending withdrawals
    const pendingRequest = await this.prisma.withdrawal_request.findFirst({
      where: {
        user_id: userId,
        status: 'PENDING',
      },
    });

    if (pendingRequest) {
      throw new BadRequestException('You already have a pending withdrawal request');
    }

    // Create withdrawal request and debit wallet in transaction
    return this.prisma.$transaction(async (tx) => {
      // Debit wallet immediately (funds are held)
      await this.walletService.debit({
        walletId: wallet.id,
        amount: requestAmount,
        referenceType: 'withdrawal_hold',
        description: 'Withdrawal request - funds held',
        metadata: { method: dto.method },
      });

      // Create withdrawal request
      const request = await tx.withdrawal_request.create({
        data: {
          user_id: userId,
          amount: requestAmount,
          method: dto.method,
          account_info: dto.accountInfo as Prisma.InputJsonValue,
        },
      });

      // Audit log
      await this.auditService.log({
        userId,
        action: 'WITHDRAWAL_REQUESTED',
        targetType: 'withdrawal_request',
        targetId: request.id,
        metadata: {
          amount: dto.amount,
          method: dto.method,
        },
      });

      return request;
    });
  }

  async findById(id: string) {
    const request = await this.prisma.withdrawal_request.findUnique({
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
      },
    });

    if (!request) {
      throw new NotFoundException('Withdrawal request not found');
    }

    return request;
  }

  async findByUser(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.withdrawal_request.findMany({
        where: { user_id: userId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.withdrawal_request.count({ where: { user_id: userId } }),
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

  async findAll(page = 1, limit = 20, status?: withdrawal_status) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [data, total] = await Promise.all([
      this.prisma.withdrawal_request.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullname: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.withdrawal_request.count({ where }),
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

  async processRequest(id: string, adminId: string, dto: ProcessWithdrawalDto) {
    const request = await this.prisma.withdrawal_request.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!request) {
      throw new NotFoundException('Withdrawal request not found');
    }

    if (request.status !== 'PENDING' && request.status !== 'APPROVED') {
      throw new BadRequestException(`Cannot process withdrawal in ${request.status} status`);
    }

    // Validate status transitions
    if (request.status === 'PENDING') {
      if (!['APPROVED', 'REJECTED'].includes(dto.status)) {
        throw new BadRequestException('Can only approve or reject pending requests');
      }
    }

    if (request.status === 'APPROVED') {
      if (!['PAID', 'REJECTED'].includes(dto.status)) {
        throw new BadRequestException('Can only mark as paid or reject approved requests');
      }
    }

    // If marking as paid, proof is required
    if (dto.status === 'PAID' && !dto.proofFileUrl) {
      throw new BadRequestException('Proof of payment is required');
    }

    return this.prisma.$transaction(async (tx) => {
      // If rejecting, refund the held amount
      if (dto.status === 'REJECTED') {
        const wallet = await this.walletService.getWalletByUserId(request.user_id);
        await this.walletService.credit({
          walletId: wallet.id,
          amount: request.amount,
          referenceId: id,
          referenceType: 'withdrawal_refund',
          description: 'Withdrawal rejected - funds returned',
        });
      }

      // Update request
      const updatedRequest = await tx.withdrawal_request.update({
        where: { id },
        data: {
          status: dto.status,
          admin_note: dto.adminNote,
          proof_file_url: dto.proofFileUrl,
          processed_by: adminId,
          processed_at: dto.status === 'PAID' ? new Date() : undefined,
        },
      });

      // Audit log
      await this.auditService.log({
        userId: adminId,
        action: `WITHDRAWAL_${dto.status}`,
        targetType: 'withdrawal_request',
        targetId: id,
        metadata: {
          previousStatus: request.status,
          newStatus: dto.status,
          adminNote: dto.adminNote,
          amount: request.amount.toString(),
        },
      });

      return updatedRequest;
    });
  }

  async cancelRequest(id: string, userId: string) {
    const request = await this.prisma.withdrawal_request.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Withdrawal request not found');
    }

    if (request.user_id !== userId) {
      throw new ForbiddenException('Not authorized to cancel this request');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Can only cancel pending requests');
    }

    return this.prisma.$transaction(async (tx) => {
      // Refund the held amount
      const wallet = await this.walletService.getWalletByUserId(userId);
      await this.walletService.credit({
        walletId: wallet.id,
        amount: request.amount,
        referenceId: id,
        referenceType: 'withdrawal_cancelled',
        description: 'Withdrawal cancelled - funds returned',
      });

      // Delete the request or mark as cancelled
      await tx.withdrawal_request.update({
        where: { id },
        data: { status: 'REJECTED', admin_note: 'Cancelled by user' },
      });

      // Audit log
      await this.auditService.log({
        userId,
        action: 'WITHDRAWAL_CANCELLED',
        targetType: 'withdrawal_request',
        targetId: id,
        metadata: {
          amount: request.amount.toString(),
        },
      });

      return { message: 'Withdrawal request cancelled' };
    });
  }
}
