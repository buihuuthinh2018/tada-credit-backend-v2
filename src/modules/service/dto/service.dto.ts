import { IsString, IsOptional, IsBoolean, IsArray, IsUUID, ValidateNested } from 'class-validator';
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
}
