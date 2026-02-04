import { IsString, IsNumber, IsBoolean, IsOptional, Min, Max, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ==========================================
// Commission Config DTOs
// ==========================================

export class CreateCommissionConfigDto {
  @ApiProperty({ description: 'Role code (CTV, USER)', example: 'CTV' })
  @IsString()
  roleCode: string;

  @ApiProperty({ description: 'Commission rate (0-1)', example: 0.05, minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  rate: number; // 0.05 = 5%
}

export class UpdateCommissionConfigDto {
  @ApiPropertyOptional({ description: 'Commission rate (0-1)', example: 0.05 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  rate?: number;

  @ApiPropertyOptional({ description: 'Is active', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ==========================================
// KPI Tier DTOs
// ==========================================

export class CreateKpiTierDto {
  @ApiProperty({ description: 'Tier name', example: 'Gold' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Role code (CTV, USER)', example: 'CTV' })
  @IsString()
  roleCode: string;

  @ApiPropertyOptional({ description: 'Minimum contracts required', example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  minContracts?: number;

  @ApiPropertyOptional({ description: 'Minimum disbursement amount', example: 500000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minDisbursement?: number;

  @ApiProperty({ description: 'Bonus rate (0-1)', example: 0.01, minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  bonusRate: number;

  @ApiProperty({ description: 'Tier order (higher = better tier)', example: 1 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  tierOrder: number;
}

export class UpdateKpiTierDto {
  @ApiPropertyOptional({ description: 'Tier name', example: 'Gold' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Minimum contracts required', example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  minContracts?: number;

  @ApiPropertyOptional({ description: 'Minimum disbursement amount', example: 500000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minDisbursement?: number;

  @ApiPropertyOptional({ description: 'Bonus rate (0-1)', example: 0.01 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  bonusRate?: number;

  @ApiPropertyOptional({ description: 'Tier order (higher = better tier)', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  tierOrder?: number;

  @ApiPropertyOptional({ description: 'Is active', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
