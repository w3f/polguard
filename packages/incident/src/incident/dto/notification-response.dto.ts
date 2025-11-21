import { NotificationType } from '@w3f/polguard-common';
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

  @ApiProperty({ required: false })
  repeatFiringMs?: number;

  @ApiProperty({ required: false })
  lastSentAt?: Date;

  @ApiProperty()
  isDelivered: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
