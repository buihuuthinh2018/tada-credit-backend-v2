import { IsNumber, IsPositive, IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { wallet_transaction_type } from '@prisma/client';

export class CreateTransactionDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(wallet_transaction_type)
  type: wallet_transaction_type;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
