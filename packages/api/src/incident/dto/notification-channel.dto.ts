import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber } from 'class-validator';
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
    example: 'matrix',
  })
  @IsEnum(MessengerType)
  messengerType: MessengerType;

  @ApiProperty({
    description: 'Interval in hours for repeating notifications if the incident remains unresolved',
    required: false,
    example: 24,
  })
  @IsOptional()
  @IsNumber()
  repeatHours?: number;
}
