import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { AuditService } from '../audit/audit.service';
import { 
  CreateCommissionConfigDto, 
  UpdateCommissionConfigDto,
  CreateKpiTierDto,
  UpdateKpiTierDto 
} from './dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CommissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly auditService: AuditService,
  ) {}

  // ==========================================
  // Commission Config Management
  // ==========================================
  
  async createConfig(dto: CreateCommissionConfigDto) {
    const existing = await this.prisma.commission_config.findFirst({
      where: { role_code: dto.roleCode.toUpperCase(), is_active: true },
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
      where: { role_code: roleCode.toUpperCase(), is_active: true },
    });

    return config?.rate ?? null;
  }

  // ==========================================
  // KPI Tier Management
  // ==========================================

  async createKpiTier(dto: CreateKpiTierDto) {
    return this.prisma.kpi_commission_tier.create({
      data: {
        name: dto.name,
        role_code: dto.roleCode.toUpperCase(),
        min_contracts: dto.minContracts,
        min_disbursement: dto.minDisbursement,
        bonus_amount: dto.bonusAmount,
        tier_order: dto.tierOrder,
      },
    });
  }

  async findAllKpiTiers(page = 1, limit = 20, roleCode?: string) {
    const skip = (page - 1) * limit;
    const where = roleCode ? { role_code: roleCode.toUpperCase() } : {};

    const [data, total] = await Promise.all([
      this.prisma.kpi_commission_tier.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ role_code: 'asc' }, { tier_order: 'asc' }],
      }),
      this.prisma.kpi_commission_tier.count({ where }),
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

  async findKpiTierById(id: string) {
    const tier = await this.prisma.kpi_commission_tier.findUnique({ where: { id } });
    if (!tier) {
      throw new NotFoundException('KPI tier not found');
    }
    return tier;
  }

  async updateKpiTier(id: string, dto: UpdateKpiTierDto) {
    const tier = await this.prisma.kpi_commission_tier.findUnique({ where: { id } });
    if (!tier) {
      throw new NotFoundException('KPI tier not found');
    }

    return this.prisma.kpi_commission_tier.update({
      where: { id },
      data: {
        name: dto.name,
        min_contracts: dto.minContracts,
        min_disbursement: dto.minDisbursement,
        bonus_amount: dto.bonusAmount,
        tier_order: dto.tierOrder,
        is_active: dto.isActive,
      },
    });
  }

  async deleteKpiTier(id: string) {
    const tier = await this.prisma.kpi_commission_tier.findUnique({ where: { id } });
    if (!tier) {
      throw new NotFoundException('KPI tier not found');
    }

    // Check if tier is used in any snapshot
    const usedInSnapshot = await this.prisma.commission_snapshot.findFirst({
      where: { kpi_tier_id: id },
    });

    if (usedInSnapshot) {
      throw new BadRequestException('Cannot delete KPI tier that has been used in snapshots');
    }

    return this.prisma.kpi_commission_tier.delete({ where: { id } });
  }

  // ==========================================
  // Commission Processing
  // ==========================================

  /**
   * Get the commission rate for a referrer based on their highest-priority role
   * CTV role takes priority over USER role
   */
  async getReferrerCommissionRate(referrerId: string): Promise<{ rate: Decimal; roleCode: string }> {
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
      if (ctvRate) return { rate: ctvRate, roleCode: 'CTV' };
    }

    // Fall back to USER rate
    const userRate = await this.getCommissionRate('USER');
    if (userRate) return { rate: userRate, roleCode: 'USER' };

    // Default to 0 if no config found
    return { rate: new Decimal(0), roleCode: 'USER' };
  }

  /**
   * Process commission when a contract reaches a commission-triggering stage
   * Commission is calculated based on totalRevenue (disbursementAmount * revenuePercentage / 100)
   */
  async processContractCompletion(
    contractId: string, 
    userId: string, 
    disbursementAmount: number,
    revenuePercentage: number,
    totalRevenue: number
  ) {
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

    // Check if commission already recorded for this contract
    const existingRecord = await this.prisma.commission_record.findFirst({
      where: { contract_id: contractId },
    });

    if (existingRecord) {
      console.log(`Commission already recorded for contract ${contractId}`);
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
    const { rate, roleCode } = await this.getReferrerCommissionRate(referrer.id);
    if (rate.equals(0)) {
      return null; // No commission configured
    }

    // Calculate commission based on totalRevenue (not disbursementAmount)
    const baseAmount = new Decimal(totalRevenue);
    const commissionAmount = baseAmount.times(rate);

    // Create commission record (PENDING status, will be credited during snapshot)
    const commissionRecord = await this.prisma.commission_record.create({
      data: {
        user_id: referrer.id,
        contract_id: contractId,
        referred_user_id: userId,
        amount: commissionAmount,
        rate: rate,
        disbursement_amount: disbursementAmount,
        revenue_percentage: revenuePercentage,
        total_revenue: totalRevenue,
        status: 'PENDING',
      },
    });

    // Credit commission to referrer's wallet immediately
    const wallet = await this.walletService.getOrCreateWallet(referrer.id);
    const result = await this.walletService.credit({
      walletId: wallet.id,
      amount: commissionAmount,
      referenceId: commissionRecord.id,
      referenceType: 'commission',
      description: `Hoa hồng hợp đồng #${contractId.slice(0, 8)}`,
      metadata: {
        referredUserId: userId,
        contractId,
        serviceId: contract.service_id,
        serviceName: contract.service.name,
        rate: rate.toString(),
        disbursementAmount: disbursementAmount.toString(),
        revenuePercentage: revenuePercentage.toString(),
        totalRevenue: totalRevenue.toString(),
        roleCode,
      },
    });

    // Update commission record status
    await this.prisma.commission_record.update({
      where: { id: commissionRecord.id },
      data: { 
        status: 'CREDITED',
        credited_at: new Date(),
      },
    });

    // Audit log
    await this.auditService.log({
      userId: referrer.id,
      action: 'COMMISSION_CREDITED',
      targetType: 'commission_record',
      targetId: commissionRecord.id,
      metadata: {
        contractId,
        referredUserId: userId,
        amount: commissionAmount.toString(),
        rate: rate.toString(),
        disbursementAmount: disbursementAmount.toString(),
        revenuePercentage: revenuePercentage.toString(),
        totalRevenue: totalRevenue.toString(),
        transactionId: result.transaction.id,
      },
    });

    return {
      recordId: commissionRecord.id,
      referrerId: referrer.id,
      amount: commissionAmount,
      rate,
      transactionId: result.transaction.id,
    };
  }

  // ==========================================
  // Commission Records & History
  // ==========================================

  /**
   * Get commission records for a user (as earner)
   */
  async getCommissionRecords(userId: string, page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: { user_id: string; status?: string } = { user_id: userId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.commission_record.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          referred_user: {
            select: { id: true, fullname: true, email: true },
          },
        },
      }),
      this.prisma.commission_record.count({ where }),
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

  /**
   * Get commission history for a user (from wallet transactions)
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

  // ==========================================
  // Snapshot Management
  // ==========================================

  /**
   * Get snapshots for a user
   */
  async getUserSnapshots(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.commission_snapshot.findMany({
        where: { user_id: userId },
        skip,
        take: limit,
        orderBy: [{ period_year: 'desc' }, { period_month: 'desc' }],
        include: {
          kpi_tier: true,
        },
      }),
      this.prisma.commission_snapshot.count({ where: { user_id: userId } }),
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

  /**
   * Get all snapshots (admin)
   */
  async getAllSnapshots(page = 1, limit = 20, filters?: { year?: number; month?: number; status?: string }) {
    const skip = (page - 1) * limit;
    const where: { period_year?: number; period_month?: number; status?: string } = {};
    
    if (filters?.year) where.period_year = filters.year;
    if (filters?.month) where.period_month = filters.month;
    if (filters?.status) where.status = filters.status;

    const [data, total] = await Promise.all([
      this.prisma.commission_snapshot.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ period_year: 'desc' }, { period_month: 'desc' }],
        include: {
          user: {
            select: { id: true, fullname: true, email: true },
          },
          kpi_tier: true,
        },
      }),
      this.prisma.commission_snapshot.count({ where }),
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

  /**
   * Calculate and determine which KPI tier a user qualifies for
   */
  async calculateKpiTier(
    roleCode: string, 
    totalContracts: number, 
    totalDisbursement: Decimal
  ): Promise<{ tier: { id: string; name: string; bonus_amount: Decimal } | null; bonusAmount: Decimal }> {
    // Get all active tiers for this role, ordered by tier_order descending (highest first)
    const tiers = await this.prisma.kpi_commission_tier.findMany({
      where: { role_code: roleCode.toUpperCase(), is_active: true },
      orderBy: { tier_order: 'desc' },
    });

    // Find the highest tier the user qualifies for
    for (const tier of tiers) {
      const meetsContractRequirement = !tier.min_contracts || totalContracts >= tier.min_contracts;
      const meetsDisbursementRequirement = !tier.min_disbursement || totalDisbursement.gte(tier.min_disbursement);

      if (meetsContractRequirement && meetsDisbursementRequirement) {
        // Use fixed bonus amount instead of rate-based calculation
        const bonusAmount = new Decimal(tier.bonus_amount);
        return {
          tier: {
            id: tier.id,
            name: tier.name,
            bonus_amount: tier.bonus_amount,
          },
          bonusAmount,
        };
      }
    }

    return { tier: null, bonusAmount: new Decimal(0) };
  }

  /**
   * Create monthly snapshot for a user (called by scheduler)
   */
  async createMonthlySnapshot(userId: string, year: number, month: number) {
    // Check if snapshot already exists
    const existing = await this.prisma.commission_snapshot.findUnique({
      where: {
        user_id_period_month_period_year: {
          user_id: userId,
          period_month: month,
          period_year: year,
        },
      },
    });

    if (existing) {
      return existing;
    }

    // Get user's role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roleCode = user.roles.find(r => r.role.code === 'CTV')?.role.code || 'USER';

    // Calculate totals for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const records = await this.prisma.commission_record.findMany({
      where: {
        user_id: userId,
        status: 'CREDITED',
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalContracts = records.length;
    const totalDisbursement = records.reduce(
      (sum, r) => sum.plus(r.disbursement_amount || 0),
      new Decimal(0)
    );
    const baseCommission = records.reduce(
      (sum, r) => sum.plus(r.amount),
      new Decimal(0)
    );

    // Calculate KPI tier and bonus
    const { tier, bonusAmount } = await this.calculateKpiTier(
      roleCode,
      totalContracts,
      totalDisbursement
    );

    const totalCommission = baseCommission.plus(bonusAmount);

    // Create snapshot
    const snapshot = await this.prisma.commission_snapshot.create({
      data: {
        user_id: userId,
        period_month: month,
        period_year: year,
        total_contracts: totalContracts,
        total_disbursement: totalDisbursement,
        base_commission: baseCommission,
        kpi_tier_id: tier?.id,
        bonus_commission: bonusAmount,
        total_commission: totalCommission,
        status: 'PENDING',
      },
      include: {
        kpi_tier: true,
      },
    });

    // Audit log
    await this.auditService.log({
      userId,
      action: 'COMMISSION_SNAPSHOT_CREATED',
      targetType: 'commission_snapshot',
      targetId: snapshot.id,
      metadata: {
        year,
        month,
        totalContracts,
        totalDisbursement: totalDisbursement.toString(),
        baseCommission: baseCommission.toString(),
        bonusCommission: bonusAmount.toString(),
        kpiTier: tier?.name,
      },
    });

    return snapshot;
  }

  /**
   * Process KPI bonus for a snapshot (credit bonus to wallet)
   */
  async processSnapshotBonus(snapshotId: string, adminId: string) {
    const snapshot = await this.prisma.commission_snapshot.findUnique({
      where: { id: snapshotId },
      include: { kpi_tier: true, user: true },
    });

    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    if (snapshot.status === 'PROCESSED' || snapshot.status === 'PAID') {
      throw new BadRequestException('Snapshot has already been processed');
    }

    if (snapshot.bonus_commission.equals(0)) {
      // No bonus to process, just mark as processed
      return this.prisma.commission_snapshot.update({
        where: { id: snapshotId },
        data: { status: 'PROCESSED', processed_at: new Date() },
      });
    }

    // Credit bonus to user's wallet
    const wallet = await this.walletService.getOrCreateWallet(snapshot.user_id);
    await this.walletService.credit({
      walletId: wallet.id,
      amount: snapshot.bonus_commission,
      referenceId: snapshotId,
      referenceType: 'kpi_bonus',
      description: `Thưởng KPI tháng ${snapshot.period_month}/${snapshot.period_year} - ${snapshot.kpi_tier?.name || 'N/A'}`,
      metadata: {
        snapshotId,
        kpiTier: snapshot.kpi_tier?.name,
        periodMonth: snapshot.period_month,
        periodYear: snapshot.period_year,
      },
    });

    // Update snapshot status
    const updated = await this.prisma.commission_snapshot.update({
      where: { id: snapshotId },
      data: { status: 'PROCESSED', processed_at: new Date() },
    });

    // Audit log
    await this.auditService.log({
      userId: adminId,
      action: 'COMMISSION_BONUS_PROCESSED',
      targetType: 'commission_snapshot',
      targetId: snapshotId,
      metadata: {
        userId: snapshot.user_id,
        bonusAmount: snapshot.bonus_commission.toString(),
        kpiTier: snapshot.kpi_tier?.name,
      },
    });

    return updated;
  }

  // ==========================================
  // Statistics
  // ==========================================

  /**
   * Get revenue statistics (Admin only)
   * Aggregates total_revenue from contracts grouped by period and/or user
   */
  async getRevenueStatistics(params: {
    period: 'daily' | 'weekly' | 'monthly' | 'yearly';
    startDate?: Date;
    endDate?: Date;
    userId?: string; // Filter by CTV/creator
  }) {
    const { period, startDate, endDate, userId } = params;
    
    const now = new Date();
    let dateFrom = startDate;
    let dateTo = endDate || now;
    
    // Default date ranges per period
    if (!dateFrom) {
      switch (period) {
        case 'daily':
          dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30); // Last 30 days
          break;
        case 'weekly':
          dateFrom = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); // Last 3 months
          break;
        case 'monthly':
          dateFrom = new Date(now.getFullYear() - 1, now.getMonth(), 1); // Last 12 months
          break;
        case 'yearly':
          dateFrom = new Date(now.getFullYear() - 5, 0, 1); // Last 5 years
          break;
      }
    }

    // Build where clause
    const whereClause: { total_revenue?: { not: null }; created_at?: { gte: Date; lte: Date }; creator_id?: string } = {
      total_revenue: { not: null },
      created_at: { gte: dateFrom, lte: dateTo },
    };
    
    if (userId) {
      whereClause.creator_id = userId;
    }

    const contracts = await this.prisma.contract.findMany({
      where: whereClause,
      select: {
        id: true,
        contract_number: true,
        total_revenue: true,
        disbursed_amount: true,
        revenue_percentage: true,
        created_at: true,
        creator_id: true,
        creator: {
          select: { id: true, fullname: true, email: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    // Group by period
    const groupedData = new Map<string, { 
      revenue: Decimal; 
      disbursement: Decimal; 
      count: number;
      contracts: typeof contracts;
      periodStart: Date;
      periodEnd: Date;
    }>();

    const getPeriodBounds = (date: Date, periodType: string): { start: Date; end: Date } => {
      switch (periodType) {
        case 'daily': {
          const start = new Date(date);
          start.setHours(0, 0, 0, 0);
          const end = new Date(date);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }
        case 'weekly': {
          const start = new Date(date);
          start.setDate(date.getDate() - date.getDay());
          start.setHours(0, 0, 0, 0);
          const end = new Date(start);
          end.setDate(start.getDate() + 6);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }
        case 'monthly': {
          const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
          const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
          return { start, end };
        }
        case 'yearly': {
          const start = new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
          const end = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
          return { start, end };
        }
        default:
          return { start: date, end: date };
      }
    };

    for (const contract of contracts) {
      const date = contract.created_at;
      let key: string;
      
      switch (period) {
        case 'daily':
          key = date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'yearly':
          key = String(date.getFullYear());
          break;
      }

      if (!groupedData.has(key)) {
        const bounds = getPeriodBounds(date, period);
        groupedData.set(key, { 
          revenue: new Decimal(0), 
          disbursement: new Decimal(0), 
          count: 0,
          contracts: [],
          periodStart: bounds.start,
          periodEnd: bounds.end,
        });
      }

      const group = groupedData.get(key)!;
      group.revenue = group.revenue.plus(contract.total_revenue || 0);
      group.disbursement = group.disbursement.plus(contract.disbursed_amount || 0);
      group.count += 1;
      group.contracts.push(contract);
    }

    // Convert to array
    const result = Array.from(groupedData.entries()).map(([key, data]) => ({
      period: key,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      revenue: data.revenue,
      disbursement: data.disbursement,
      contractCount: data.count,
      averagePercentage: data.disbursement.gt(0) 
        ? data.revenue.div(data.disbursement).times(100).toDecimalPlaces(2)
        : new Decimal(0),
      contracts: data.contracts.map(contract => ({
        id: contract.id,
        contractNumber: contract.contract_number,
        createdAt: contract.created_at,
        revenue: contract.total_revenue,
        disbursement: contract.disbursed_amount,
        revenuePercentage: contract.revenue_percentage,
        creatorId: contract.creator_id,
        creator: contract.creator,
      })),
    }));

    // Totals
    const totals = contracts.reduce((acc, contract) => ({
      revenue: acc.revenue.plus(contract.total_revenue || 0),
      disbursement: acc.disbursement.plus(contract.disbursed_amount || 0),
      count: acc.count + 1,
    }), { revenue: new Decimal(0), disbursement: new Decimal(0), count: 0 });

    return {
      period,
      dateFrom,
      dateTo,
      data: result,
      totals: {
        revenue: totals.revenue,
        disbursement: totals.disbursement,
        contractCount: totals.count,
        averagePercentage: totals.disbursement.gt(0)
          ? totals.revenue.div(totals.disbursement).times(100).toDecimalPlaces(2)
          : new Decimal(0),
      },
    };
  }

  /**
   * Get revenue statistics grouped by CTV/creator
   */
  async getRevenueByUser(params: {
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const { startDate, endDate, page = 1, limit = 20 } = params;
    
    const now = new Date();
    const dateFrom = startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const dateTo = endDate || now;

    const skip = (page - 1) * limit;

    // Get all contracts with revenue grouped by creator
    const contracts = await this.prisma.contract.findMany({
      where: {
        total_revenue: { not: null },
        created_at: { gte: dateFrom, lte: dateTo },
        creator_id: { not: null },
      },
      select: {
        id: true,
        total_revenue: true,
        disbursed_amount: true,
        revenue_percentage: true,
        creator_id: true,
        creator: {
          select: { id: true, fullname: true, email: true, phone: true },
        },
      },
    });

    // Group by creator
    const groupedByUser = new Map<string, {
      user: { id: string; fullname: string | null; email: string; phone: string | null };
      revenue: Decimal;
      disbursement: Decimal;
      count: number;
    }>();

    for (const contract of contracts) {
      if (!contract.creator_id || !contract.creator) continue;

      if (!groupedByUser.has(contract.creator_id)) {
        groupedByUser.set(contract.creator_id, {
          user: contract.creator,
          revenue: new Decimal(0),
          disbursement: new Decimal(0),
          count: 0,
        });
      }

      const group = groupedByUser.get(contract.creator_id)!;
      group.revenue = group.revenue.plus(contract.total_revenue || 0);
      group.disbursement = group.disbursement.plus(contract.disbursed_amount || 0);
      group.count += 1;
    }

    // Sort by revenue descending
    const sorted = Array.from(groupedByUser.values())
      .sort((a, b) => b.revenue.minus(a.revenue).toNumber());

    // Paginate
    const paginated = sorted.slice(skip, skip + limit);

    // Calculate totals
    const totals = sorted.reduce((acc, item) => ({
      revenue: acc.revenue.plus(item.revenue),
      disbursement: acc.disbursement.plus(item.disbursement),
      count: acc.count + item.count,
    }), { revenue: new Decimal(0), disbursement: new Decimal(0), count: 0 });

    return {
      data: paginated.map(item => ({
        user: item.user,
        revenue: item.revenue,
        disbursement: item.disbursement,
        contractCount: item.count,
        averagePercentage: item.disbursement.gt(0)
          ? item.revenue.div(item.disbursement).times(100).toDecimalPlaces(2)
          : new Decimal(0),
      })),
      pagination: {
        page,
        limit,
        total: sorted.length,
        totalPages: Math.ceil(sorted.length / limit),
      },
      totals: {
        revenue: totals.revenue,
        disbursement: totals.disbursement,
        contractCount: totals.count,
      },
      dateFrom,
      dateTo,
    };
  }

  /**
   * Get current user commission summary
   */
  async getUserCommissionSummary(userId: string) {
    const wallet = await this.walletService.getOrCreateWallet(userId);
    
    // Total earned from commissions
    const totalEarned = await this.prisma.wallet_transaction.aggregate({
      where: {
        wallet_id: wallet.id,
        reference_type: { in: ['commission', 'kpi_bonus'] },
        type: 'CREDIT',
      },
      _sum: { amount: true },
    });

    // Current month stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthlyRecords = await this.prisma.commission_record.findMany({
      where: {
        user_id: userId,
        created_at: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    const monthlyContracts = monthlyRecords.length;
    const monthlyCommission = monthlyRecords.reduce(
      (sum, r) => sum.plus(r.amount),
      new Decimal(0)
    );
    const monthlyDisbursement = monthlyRecords.reduce(
      (sum, r) => sum.plus(r.disbursement_amount || 0),
      new Decimal(0)
    );

    // Referred users count
    const referredCount = await this.prisma.user.count({
      where: { referred_by: userId },
    });

    return {
      totalEarned: totalEarned._sum.amount || new Decimal(0),
      currentMonth: {
        contracts: monthlyContracts,
        commission: monthlyCommission,
        disbursement: monthlyDisbursement,
      },
      referredUsers: referredCount,
      walletBalance: wallet.balance,
    };
  }
}
