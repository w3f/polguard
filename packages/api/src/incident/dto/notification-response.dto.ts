import { NotificationType } from '@w3f/monitoring-types';
import { ApiProperty } from '@nestjs/swagger';

export class NotificationResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  channelId: string;

  @ApiProperty()
  messengerType: string;

  @ApiProperty()
  type: NotificationType;

  @ApiProperty({ type: Number, format: 'float' })
  repeatHours: number;

  @ApiProperty({ required: false })
  lastSentAt?: Date;

  @ApiProperty()
  isDelivered: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
