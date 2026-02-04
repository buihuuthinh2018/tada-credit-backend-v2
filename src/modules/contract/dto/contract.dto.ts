import { IsString, IsUUID, IsArray, ValidateNested, IsOptional, IsNumber, Min } from 'class-validator';
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
}
