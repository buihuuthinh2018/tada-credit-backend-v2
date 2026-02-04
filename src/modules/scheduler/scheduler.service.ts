import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CommissionService } from '../commission/commission.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionService: CommissionService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get the configured snapshot day from system_config
   * Default is day 1 of each month
   */
  async getSnapshotDay(): Promise<number> {
    const config = await this.prisma.system_config.findUnique({
      where: { key: 'commission_snapshot_day' },
    });

    if (config && typeof config.value === 'number') {
      return config.value;
    }

    // Check if it's an object with a day property
    if (config && typeof config.value === 'object' && config.value !== null) {
      const value = config.value as { day?: number };
      return value.day || 1;
    }

    return 1; // Default to 1st of month
  }

  /**
   * Run daily at 1:00 AM to check if today is snapshot day
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleDailySnapshotCheck() {
    this.logger.log('Running daily snapshot check...');

    const today = new Date();
    const currentDay = today.getDate();
    const snapshotDay = await this.getSnapshotDay();

    if (currentDay !== snapshotDay) {
      this.logger.log(`Today is not snapshot day (configured: ${snapshotDay})`);
      return;
    }

    // Today is snapshot day - run the monthly snapshot
    await this.runMonthlySnapshot();
  }

  /**
   * Create snapshots for all users with commission records
   * This runs on the snapshot day configured by admin
   */
  async runMonthlySnapshot() {
    const now = new Date();
    // Snapshot for the PREVIOUS month
    let snapshotMonth = now.getMonth(); // 0-11, current month
    let snapshotYear = now.getFullYear();

    // If we're on day 1-31, we snapshot for the previous month
    if (snapshotMonth === 0) {
      snapshotMonth = 12;
      snapshotYear -= 1;
    }

    this.logger.log(`Creating monthly snapshots for ${snapshotMonth}/${snapshotYear}...`);

    try {
      // Get all users who have commission records
      const usersWithCommissions = await this.prisma.commission_record.findMany({
        where: {
          created_at: {
            gte: new Date(snapshotYear, snapshotMonth - 1, 1),
            lt: new Date(snapshotYear, snapshotMonth, 1),
          },
        },
        select: {
          user_id: true,
        },
        distinct: ['user_id'],
      });

      this.logger.log(`Found ${usersWithCommissions.length} users with commissions to snapshot`);

      let successCount = 0;
      let errorCount = 0;

      for (const { user_id } of usersWithCommissions) {
        try {
          await this.commissionService.createMonthlySnapshot(user_id, snapshotYear, snapshotMonth);
          successCount++;
        } catch (error) {
          this.logger.error(`Failed to create snapshot for user ${user_id}:`, error);
          errorCount++;
        }
      }

      this.logger.log(`Monthly snapshot completed: ${successCount} success, ${errorCount} errors`);

      // Log the batch operation
      await this.auditService.log({
        userId: 'SYSTEM',
        action: 'COMMISSION_SNAPSHOT_BATCH',
        targetType: 'commission_snapshot',
        targetId: undefined,
        metadata: {
          year: snapshotYear,
          month: snapshotMonth,
          totalUsers: usersWithCommissions.length,
          successCount,
          errorCount,
        },
      });

      return { successCount, errorCount };
    } catch (error) {
      this.logger.error('Failed to run monthly snapshot:', error);
      throw error;
    }
  }

  /**
   * Run snapshot manually (for admin use)
   */
  async runManualSnapshot(year: number, month: number) {
    this.logger.log(`Running manual snapshot for ${month}/${year}...`);

    const usersWithCommissions = await this.prisma.commission_record.findMany({
      where: {
        created_at: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
      },
      select: {
        user_id: true,
      },
      distinct: ['user_id'],
    });

    this.logger.log(`Found ${usersWithCommissions.length} users to snapshot`);

    let successCount = 0;
    let errorCount = 0;
    const results: { userId: string; success: boolean; error?: string }[] = [];

    for (const { user_id } of usersWithCommissions) {
      try {
        await this.commissionService.createMonthlySnapshot(user_id, year, month);
        successCount++;
        results.push({ userId: user_id, success: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to create snapshot for user ${user_id}:`, error);
        errorCount++;
        results.push({ userId: user_id, success: false, error: errorMessage });
      }
    }

    return {
      year,
      month,
      totalUsers: usersWithCommissions.length,
      successCount,
      errorCount,
      results,
    };
  }
}
