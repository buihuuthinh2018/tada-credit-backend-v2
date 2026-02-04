import { IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateSystemConfigDto {
  @ApiProperty({ description: 'Configuration value (any JSON value)' })
  value: unknown;
}

export class UpdateSnapshotDayDto {
  @ApiProperty({ 
    description: 'Day of month for snapshot (1-28)', 
    example: 1, 
    minimum: 1, 
    maximum: 28 
  })
  @IsInt()
  @Min(1)
  @Max(28)
  @Type(() => Number)
  day: number;
}
