import { IsString, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Chain } from '@w3f/monitoring-types';

export class ResolveIncidentByChainDto {
  @ApiProperty({ description: 'Blockchain network', enum: Chain })
  @IsEnum(Chain)
  chain: Chain;

  @ApiProperty({ description: 'Block number' })
  @IsNumber()
  blockNumber: number;
}

export class ResolveIncidentManuallyDto {
  @ApiProperty({ description: 'Username who resolved the incident' })
  @IsString()
  username: string;

  @ApiProperty({ description: 'Channel ID where the resolve command was issued' })
  @IsString()
  channelId: string;
}
