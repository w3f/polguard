import { IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { MessengerType } from '@w3f/monitoring-types';
import { ApiProperty } from '@nestjs/swagger';

export class NotificationChannelDto {
  @ApiProperty({
    description: 'Channel ID where notifications should be sent',
    example: '!testroom:matrix.org',
  })
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @ApiProperty({
    description: 'Type of messenger to use for notifications',
    enum: MessengerType,
    example: 'Matrix',
  })
  @IsEnum(MessengerType)
  messengerType: MessengerType;

  @ApiProperty({
    description: 'Interval in milliseconds for repeating notifications if the incident remains unresolved',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  repeatFiringMs?: number;
}
