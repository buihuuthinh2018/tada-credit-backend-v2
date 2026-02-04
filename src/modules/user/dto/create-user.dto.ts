import { IsEmail, IsString, IsEnum, IsDateString, IsOptional, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { gender } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '0123456789',
    description: 'Phone number (10-15 digits)',
    pattern: '^[0-9]{10,15}$',
  })
  @IsString()
  @Matches(/^[0-9]{10,15}$/, { message: 'Phone must be 10-15 digits' })
  phone: string;

  @ApiProperty({
    example: 'SecurePass123',
    description: 'User password (minimum 8 characters)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Full name of the user',
    minLength: 2,
  })
  @IsString()
  @MinLength(2)
  fullname: string;

  @ApiProperty({
    example: 'male',
    description: 'User gender',
    enum: gender,
  })
  @IsEnum(gender)
  gender: gender;

  @ApiProperty({
    example: '1990-01-01',
    description: 'Birth date in ISO 8601 format',
  })
  @IsDateString()
  birthDate: string;

  @ApiPropertyOptional({
    example: 'REF123ABC',
    description: 'Optional referral code from another user',
  })
  @IsOptional()
  @IsString()
  referralCode?: string;
}
