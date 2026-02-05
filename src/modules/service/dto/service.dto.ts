import { IsString, IsOptional, IsBoolean, IsArray, IsUUID, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateServiceDocumentRequirementDto {
  @IsUUID()
  id: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class CreateServiceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  workflowId: string;

  @IsOptional()
  @IsBoolean()
  commissionEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minLoanAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxLoanAmount?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  documentRequirementIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateServiceDocumentRequirementDto)
  documentRequirements?: CreateServiceDocumentRequirementDto[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  questionIds?: string[];
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  commission_enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_loan_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_loan_amount?: number;
}
