import { IsNumber, IsPositive, IsEnum, IsString, IsOptional, IsObject } from 'class-validator';
import { withdrawal_method, withdrawal_status } from '@prisma/client';

export class CreateWithdrawalDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(withdrawal_method)
  method: withdrawal_method;

  @IsOptional()
  @IsObject()
  accountInfo?: {
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    cryptoAddress?: string;
    cryptoNetwork?: string;
  };
}

export class ProcessWithdrawalDto {
  @IsEnum(withdrawal_status)
  status: withdrawal_status;

  @IsOptional()
  @IsString()
  adminNote?: string;

  @IsOptional()
  @IsString()
  proofFileUrl?: string;
}
