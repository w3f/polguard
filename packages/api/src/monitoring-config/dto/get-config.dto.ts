import { IsArray, IsString, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { Chain } from '@w3f/monitoring-types';
import { ApiProperty } from '@nestjs/swagger';

export class GetConfigDto {
  @ApiProperty({ enum: Chain, description: 'Blockchain network' })
  @IsEnum(Chain)
  chain: Chain;

  @ApiProperty({
    description: 'Comma-separated list of group IDs.',
    type: String,
    required: false,
  })
  @Transform(({ value }) => {
    if (!value) return [];
    if (typeof value === 'string') return value.split(',');
    return value;
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groupIds: string[] = [];
}
