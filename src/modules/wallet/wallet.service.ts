import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { wallet_transaction_type, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface TransactionInput {
  walletId: string;
  type: wallet_transaction_type;
  amount: number | Decimal;
  referenceId?: string;
  referenceType?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateWallet(userId: string) {
    let wallet = await this.prisma.wallet.findUnique({
      where: { user_id: userId },
    });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: { user_id: userId },
      });
    }

    return wallet;
  }

  async getWalletByUserId(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { user_id: userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullname: true,
          },
        },
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  async getBalance(userId: string): Promise<Decimal> {
    const wallet = await this.getWalletByUserId(userId);
    return wallet.balance;
  }

  /**
   * Calculate balance from transactions (derived data)
   * This should match the stored balance
   */
  async calculateDerivedBalance(walletId: string): Promise<Decimal> {
    const transactions = await this.prisma.wallet_transaction.findMany({
      where: { wallet_id: walletId },
    });

    let balance = new Decimal(0);
    for (const tx of transactions) {
      if (tx.type === 'CREDIT') {
        balance = balance.plus(tx.amount);
      } else {
        balance = balance.minus(tx.amount);
      }
    }

    return balance;
  }

  /**
   * Credit funds to wallet (add money)
   * All credits create a CREDIT transaction and increase balance
   */
  async credit(input: Omit<TransactionInput, 'type'>) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { id: input.walletId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const amount = new Decimal(input.amount);

      // Create transaction
      const transaction = await tx.wallet_transaction.create({
        data: {
          wallet_id: input.walletId,
          type: 'CREDIT',
          amount,
          reference_id: input.referenceId,
          reference_type: input.referenceType,
          description: input.description,
          metadata: input.metadata as Prisma.InputJsonValue,
        },
      });

      // Update balance
      const newBalance = wallet.balance.plus(amount);
      await tx.wallet.update({
        where: { id: input.walletId },
        data: { balance: newBalance },
      });

      return {
        transaction,
        newBalance,
      };
    });
  }

  /**
   * Debit funds from wallet (remove money)
   * All debits create a DEBIT transaction and decrease balance
   */
  async debit(input: Omit<TransactionInput, 'type'>) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { id: input.walletId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const amount = new Decimal(input.amount);

      // Check sufficient balance
      if (wallet.balance.lessThan(amount)) {
        throw new BadRequestException('Insufficient balance');
      }

      // Create transaction
      const transaction = await tx.wallet_transaction.create({
        data: {
          wallet_id: input.walletId,
          type: 'DEBIT',
          amount,
          reference_id: input.referenceId,
          reference_type: input.referenceType,
          description: input.description,
          metadata: input.metadata as Prisma.InputJsonValue,
        },
      });

      // Update balance
      const newBalance = wallet.balance.minus(amount);
      await tx.wallet.update({
        where: { id: input.walletId },
        data: { balance: newBalance },
      });

      return {
        transaction,
        newBalance,
      };
    });
  }

  async getTransactions(walletId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.wallet_transaction.findMany({
        where: { wallet_id: walletId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.wallet_transaction.count({ where: { wallet_id: walletId } }),
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

  async getTransactionsByUser(userId: string, page = 1, limit = 20) {
    const wallet = await this.getWalletByUserId(userId);
    return this.getTransactions(wallet.id, page, limit);
  }

  /**
   * Verify wallet integrity by comparing stored balance with derived balance
   */
  async verifyWalletIntegrity(walletId: string): Promise<{ isValid: boolean; storedBalance: Decimal; derivedBalance: Decimal }> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const derivedBalance = await this.calculateDerivedBalance(walletId);
    const isValid = wallet.balance.equals(derivedBalance);

    return {
      isValid,
      storedBalance: wallet.balance,
      derivedBalance,
    };
  }
}
