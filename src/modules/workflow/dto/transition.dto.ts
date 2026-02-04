import { IsString, IsOptional } from 'class-validator';

export class CreateTransitionDto {
  @IsString()
  fromStageId: string;

  @IsString()
  toStageId: string;

  @IsOptional()
  @IsString()
  requiredPermission?: string;
}

export class UpdateTransitionDto {
  @IsOptional()
  @IsString()
  fromStageId?: string;

  @IsOptional()
  @IsString()
  toStageId?: string;

  @IsOptional()
  @IsString()
  requiredPermission?: string;
}
