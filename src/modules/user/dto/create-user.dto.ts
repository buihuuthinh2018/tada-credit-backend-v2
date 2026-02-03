import { IsEmail, IsString, IsEnum, IsDateString, IsOptional, MinLength, Matches } from 'class-validator';
import { gender } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @Matches(/^[0-9]{10,15}$/, { message: 'Phone must be 10-15 digits' })
  phone: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(2)
  fullname: string;

  @IsEnum(gender)
  gender: gender;

  @IsDateString()
  birthDate: string;

  @IsOptional()
  @IsString()
  referralCode?: string;
}
