import { IsString, IsOptional, IsBoolean, IsObject, IsInt, Min } from 'class-validator';

export class CreateDocumentRequirementDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsObject()
  config: {
    maxFiles?: number;
    minFiles?: number;
    allowedTypes?: string[];
    maxSizeBytes?: number;
    expirationDays?: number;
  };
}

export class UpdateDocumentRequirementDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  config?: {
    maxFiles?: number;
    minFiles?: number;
    allowedTypes?: string[];
    maxSizeBytes?: number;
    expirationDays?: number;
  };

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
