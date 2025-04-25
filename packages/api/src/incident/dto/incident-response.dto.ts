import { Chain } from '@w3f/monitoring-types';
import { ApiProperty } from '@nestjs/swagger';

export class IncidentResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  blockNumber?: number;

  @ApiProperty({ enum: Chain })
  chain: Chain;

  @ApiProperty()
  wallet: string;

  @ApiProperty()
  groupId: string;

  @ApiProperty()
  handler: string;

  @ApiProperty()
  channelId: string;

  @ApiProperty()
  ackRequired: boolean;

  @ApiProperty()
  acked: boolean;

  @ApiProperty({ required: false })
  ackedByUser?: string;

  @ApiProperty({ required: false })
  ackedAt?: Date;

  @ApiProperty({ required: false })
  repeatIntervalHours?: number;

  @ApiProperty()
  resolved: boolean;

  @ApiProperty({ required: false })
  resolvedAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
