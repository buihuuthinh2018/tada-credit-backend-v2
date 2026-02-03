import { IsString, IsEnum, IsDateString, IsOptional, MinLength, Matches } from 'class-validator';
import { gender, user_status } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10,15}$/, { message: 'Phone must be 10-15 digits' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  fullname?: string;

  @IsOptional()
  @IsEnum(gender)
  gender?: gender;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsEnum(user_status)
  status?: user_status;
}
