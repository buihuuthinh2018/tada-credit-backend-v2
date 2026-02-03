import { IsString, IsUUID, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class AnswerDto {
  @IsUUID()
  questionId: string;

  @IsString()
  answer: string;
}

export class CreateContractDto {
  @IsUUID()
  serviceId: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers?: AnswerDto[];
}

export class SubmitContractDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}

export class TransitionContractDto {
  @IsUUID()
  toStageId: string;

  @IsOptional()
  @IsString()
  note?: string;
}
