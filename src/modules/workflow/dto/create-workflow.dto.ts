import { IsString, IsOptional, IsInt, IsBoolean, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWorkflowStageDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsInt()
  @Min(0)
  stageOrder: number;
}

export class CreateWorkflowTransitionDto {
  @IsString()
  fromStageCode: string;

  @IsString()
  toStageCode: string;

  @IsOptional()
  @IsString()
  requiredPermission?: string;
}

export class CreateWorkflowDto {
  @IsString()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStageDto)
  stages: CreateWorkflowStageDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowTransitionDto)
  transitions: CreateWorkflowTransitionDto[];
}
