import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Known system config keys
export const SYSTEM_CONFIG_KEYS = {
  OTP_REQUIRED: 'otp_required',
  COMMISSION_SNAPSHOT_DAY: 'commission_snapshot_day',
  KPI_EVALUATION_ENABLED: 'kpi_evaluation_enabled',
} as const;

export type SystemConfigKey = typeof SYSTEM_CONFIG_KEYS[keyof typeof SYSTEM_CONFIG_KEYS];

@Injectable()
export class SystemConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig<T = unknown>(key: string): Promise<T | null> {
    const config = await this.prisma.system_config.findUnique({
      where: { key },
    });

    return config?.value as T || null;
  }

  async setConfig(key: string, value: unknown) {
    return this.prisma.system_config.upsert({
      where: { key },
      create: { key, value: value as object },
      update: { value: value as object },
    });
  }

  async getAllConfigs() {
    return this.prisma.system_config.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async deleteConfig(key: string) {
    const config = await this.prisma.system_config.findUnique({
      where: { key },
    });

    if (!config) {
      throw new NotFoundException('Config not found');
    }

    return this.prisma.system_config.delete({
      where: { key },
    });
  }

  // Specific config getters
  async getSnapshotDay(): Promise<number> {
    const value = await this.getConfig<{ day: number }>(SYSTEM_CONFIG_KEYS.COMMISSION_SNAPSHOT_DAY);
    return value?.day || 1;
  }

  async setSnapshotDay(day: number) {
    if (day < 1 || day > 28) {
      throw new Error('Snapshot day must be between 1 and 28');
    }
    return this.setConfig(SYSTEM_CONFIG_KEYS.COMMISSION_SNAPSHOT_DAY, { day });
  }

  async isKpiEvaluationEnabled(): Promise<boolean> {
    const value = await this.getConfig<boolean>(SYSTEM_CONFIG_KEYS.KPI_EVALUATION_ENABLED);
    return value ?? true;
  }

  async setKpiEvaluationEnabled(enabled: boolean) {
    return this.setConfig(SYSTEM_CONFIG_KEYS.KPI_EVALUATION_ENABLED, enabled);
  }
}
