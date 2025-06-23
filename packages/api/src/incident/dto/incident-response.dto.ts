import { Chain } from '@w3f/monitoring-types';
import { ApiProperty } from '@nestjs/swagger';
import { NotificationResponseDto } from './notification-response.dto';

export class IncidentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  blockNumber?: number;

  @ApiProperty({ enum: Chain })
  chain: Chain;

  @ApiProperty()
  account: string;

  @ApiProperty()
  groupId: string;

  @ApiProperty()
  handlerType: string;

  @ApiProperty()
  needsAck: boolean;

  @ApiProperty()
  isAcked: boolean;

  @ApiProperty({ required: false })
  ackedBy?: string;

  @ApiProperty({ required: false })
  ackedAt?: Date;

  @ApiProperty()
  isResolved: boolean;

  @ApiProperty({ required: false })
  resolvedAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [NotificationResponseDto] })
  notifications: NotificationResponseDto[];
}
