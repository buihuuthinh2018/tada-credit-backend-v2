import { IsString, IsOptional, IsInt, IsBoolean, IsArray, ValidateNested, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkflowStageDto {
  @ApiProperty({ description: 'Stage code (unique within workflow)', example: 'REVIEWING' })
  @IsString()
  code: string;

  @ApiProperty({ description: 'Stage display name', example: 'Đang xem xét' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Stage order (0-based)', example: 1, minimum: 0 })
  @IsInt()
  @Min(0)
  stageOrder: number;

  @ApiPropertyOptional({ description: 'Hex color code', example: '#3B82F6' })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'color must be a valid hex color code (e.g., #FF5733)',
  })
  color?: string;

  @ApiPropertyOptional({ description: 'Is this a required stage (DRAFT, SUBMITTED, COMPLETED)', example: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ description: 'Does reaching this stage trigger commission?', example: false })
  @IsOptional()
  @IsBoolean()
  triggersCommission?: boolean;
}

export class CreateWorkflowTransitionDto {
  @ApiProperty({ description: 'Source stage code', example: 'DRAFT' })
  @IsString()
  fromStageCode: string;

  @ApiProperty({ description: 'Target stage code', example: 'REVIEWING' })
  @IsString()
  toStageCode: string;

  @ApiPropertyOptional({ description: 'Required permission to perform this transition', example: 'contract:submit' })
  @IsOptional()
  @IsString()
  requiredPermission?: string;
}

export class CreateWorkflowDto {
  @ApiProperty({ description: 'Workflow name', example: 'Credit Approval Workflow' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Workflow description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ 
    description: 'List of stages in the workflow',
    type: [CreateWorkflowStageDto],
    example: [
      { code: 'DRAFT', name: 'Nháp', stageOrder: 0, color: '#6B7280' },
      { code: 'REVIEWING', name: 'Đang xem xét', stageOrder: 1, color: '#3B82F6' },
      { code: 'APPROVED', name: 'Đã duyệt', stageOrder: 2, color: '#10B981' },
    ]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStageDto)
  stages?: CreateWorkflowStageDto[];

  @ApiPropertyOptional({ 
    description: 'List of transitions between stages',
    type: [CreateWorkflowTransitionDto],
    example: [
      { fromStageCode: 'DRAFT', toStageCode: 'REVIEWING', requiredPermission: 'contract:submit' },
      { fromStageCode: 'REVIEWING', toStageCode: 'APPROVED', requiredPermission: 'contract:approve' },
    ]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowTransitionDto)
  transitions?: CreateWorkflowTransitionDto[];
}
