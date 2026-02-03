import { IsString, IsNumber, IsBoolean, IsOptional, Min, Max } from 'class-validator';

export class CreateCommissionConfigDto {
  @IsString()
  roleCode: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  rate: number; // 0.1 = 10%
}

export class UpdateCommissionConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  rate?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
