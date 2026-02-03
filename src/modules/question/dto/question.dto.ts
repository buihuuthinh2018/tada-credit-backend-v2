import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  content: string;

  @IsString()
  type: string; // 'text', 'number', 'date', 'select', 'checkbox', etc.

  @IsOptional()
  @IsObject()
  config?: {
    options?: string[];
    min?: number;
    max?: number;
    placeholder?: string;
  };
}

export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsObject()
  config?: {
    options?: string[];
    min?: number;
    max?: number;
    placeholder?: string;
  };

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
