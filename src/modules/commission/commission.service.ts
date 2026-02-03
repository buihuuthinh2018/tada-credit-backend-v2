import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { AuditService } from '../audit/audit.service';
import { CreateCommissionConfigDto, UpdateCommissionConfigDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CommissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly auditService: AuditService,
  ) {}

  // Commission Config Management
  async createConfig(dto: CreateCommissionConfigDto) {
    const existing = await this.prisma.commission_config.findFirst({
      where: { role_code: dto.roleCode, is_active: true },
    });

    if (existing) {
      throw new ConflictException('Active commission config already exists for this role');
    }

    return this.prisma.commission_config.create({
      data: {
        role_code: dto.roleCode.toUpperCase(),
        rate: dto.rate,
      },
    });
  }

  async findAllConfigs(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.commission_config.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.commission_config.count(),
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

  async findConfigById(id: string) {
    const config = await this.prisma.commission_config.findUnique({ where: { id } });
    if (!config) {
      throw new NotFoundException('Commission config not found');
    }
    return config;
  }

  async updateConfig(id: string, dto: UpdateCommissionConfigDto) {
    const config = await this.prisma.commission_config.findUnique({ where: { id } });
    if (!config) {
      throw new NotFoundException('Commission config not found');
    }

    return this.prisma.commission_config.update({
      where: { id },
      data: {
        rate: dto.rate,
        is_active: dto.isActive,
      },
    });
  }

  async getCommissionRate(roleCode: string): Promise<Decimal | null> {
    const config = await this.prisma.commission_config.findFirst({
      where: { role_code: roleCode, is_active: true },
    });

    return config?.rate ?? null;
  }

  /**
   * Get the commission rate for a referrer based on their highest-priority role
   * CTV role takes priority over USER role
   */
  async getReferrerCommissionRate(referrerId: string): Promise<Decimal> {
    const user = await this.prisma.user.findUnique({
      where: { id: referrerId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Referrer not found');
    }

    const roleCodes = user.roles.map((ur) => ur.role.code);

    // Check CTV rate first (higher priority)
    if (roleCodes.includes('CTV')) {
      const ctvRate = await this.getCommissionRate('CTV');
      if (ctvRate) return ctvRate;
    }

    // Fall back to USER rate
    const userRate = await this.getCommissionRate('USER');
    if (userRate) return userRate;

    // Default to 0 if no config found
    return new Decimal(0);
  }

  /**
   * Process commission when a contract is completed
   */
  async processContractCompletion(contractId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        referrer: true,
      },
    });

    if (!user || !user.referrer) {
      // No referrer, no commission
      return null;
    }

    const referrer = user.referrer;
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        service: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Get commission rate for referrer
    const rate = await this.getReferrerCommissionRate(referrer.id);
    if (rate.equals(0)) {
      return null; // No commission configured
    }

    // For simplicity, we'll use a fixed commission base amount
    // In a real system, this would be based on the contract value/service fee
    const baseAmount = new Decimal(100); // Example: 100 units
    const commissionAmount = baseAmount.times(rate);

    // Get or create referrer's wallet
    const wallet = await this.walletService.getOrCreateWallet(referrer.id);

    // Credit commission to referrer's wallet
    const result = await this.walletService.credit({
      walletId: wallet.id,
      amount: commissionAmount,
      referenceId: contractId,
      referenceType: 'commission',
      description: `Commission for contract ${contractId}`,
      metadata: {
        referredUserId: userId,
        contractId,
        serviceId: contract.service_id,
        serviceName: contract.service.name,
        rate: rate.toString(),
        baseAmount: baseAmount.toString(),
      },
    });

    // Audit log
    await this.auditService.log({
      userId: referrer.id,
      action: 'COMMISSION_CREDITED',
      targetType: 'wallet',
      targetId: wallet.id,
      metadata: {
        contractId,
        referredUserId: userId,
        amount: commissionAmount.toString(),
        rate: rate.toString(),
      },
    });

    return {
      referrerId: referrer.id,
      amount: commissionAmount,
      rate,
      transactionId: result.transaction.id,
    };
  }

  /**
   * Get commission history for a user
   */
  async getCommissionHistory(userId: string, page = 1, limit = 20) {
    const wallet = await this.walletService.getOrCreateWallet(userId);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.wallet_transaction.findMany({
        where: {
          wallet_id: wallet.id,
          reference_type: 'commission',
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.wallet_transaction.count({
        where: {
          wallet_id: wallet.id,
          reference_type: 'commission',
        },
      }),
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
}
