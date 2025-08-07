import { IsEnum, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Chain } from '@w3f/monitoring-types';

export class SetLastBlockDto {
  @ApiProperty({ description: 'Blockchain network', enum: Chain })
  @IsEnum(Chain)
  chain: Chain;

  @ApiProperty({ description: 'Block number' })
  @IsNumber()
  blockNumber: number;
}
