import { IsString, IsUUID, IsArray, ValidateNested, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnswerDto {
  @ApiProperty({ description: 'Question ID' })
  @IsUUID()
  questionId: string;

  @ApiProperty({ description: 'Answer value' })
  @IsString()
  answer: string;
}

export class CreateContractDto {
  @ApiProperty({ description: 'Service ID' })
  @IsUUID()
  serviceId: string;

  @ApiPropertyOptional({ 
    description: 'Target user ID (for CTV creating contract on behalf of another user)',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @ApiProperty({ 
    description: 'Requested loan amount (must be within service min/max range)',
    example: 50000000
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  requestedAmount: number;

  @ApiPropertyOptional({ description: 'Initial answers', type: [AnswerDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers?: AnswerDto[];
}

export class SubmitContractDto {
  @ApiProperty({ description: 'Contract answers', type: [AnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}

export class TransitionContractDto {
  @ApiProperty({ description: 'Target stage ID' })
  @IsUUID()
  toStageId: string;

  @ApiPropertyOptional({ description: 'Transition note' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ 
    description: 'Disbursement amount (required for commission calculation when reaching commission trigger stage)',
    example: 50000000
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  disbursementAmount?: number;

  @ApiPropertyOptional({ 
    description: 'Revenue percentage from the contract (e.g., 10.5 for 10.5%)',
    example: 10.5
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  revenuePercentage?: number;
}

export class UpdateDisbursementDto {
  @ApiProperty({ 
    description: 'Actual disbursement amount',
    example: 50000000
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  disbursedAmount: number;
}
