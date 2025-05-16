import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Chain } from '@w3f/monitoring-types';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { NotificationChannelDto } from './notification-channel.dto';

export class CreateIncidentDto {
  @ApiProperty({
    description: 'Message describing the incident',
    example: 'Validator XXX has been slashed',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'Blockchain network where the incident occurred',
    enum: Chain,
    example: 'Polkadot',
  })
  @IsEnum(Chain)
  chain: Chain;

  @ApiProperty({
    description: 'Block number when the incident was detected',
    example: 12345678,
  })
  @IsNumber()
  blockNumber: number;

  @ApiProperty({
    description: 'Account address associated with the incident',
    example: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
  })
  @IsString()
  @IsNotEmpty()
  account: string;

  @ApiProperty({
    description: 'Monitoring group ID that the incident belongs to',
    example: 'validators-default',
  })
  @IsString()
  @IsNotEmpty()
  groupId: string;

  @ApiProperty({
    description: 'Handler type that detected the incident',
    example: 'SlashReported',
  })
  @IsString()
  @IsNotEmpty()
  handlerType: string;

  @ApiProperty({
    description: 'Notification channels for this incident',
    type: [NotificationChannelDto],
  })
  @ValidateNested({ each: true })
  @Type(() => NotificationChannelDto)
  @ArrayMinSize(1)
  notificationChannels: NotificationChannelDto[];

  @ApiProperty({
    description: 'Whether the incident requires acknowledgment',
    default: false,
    required: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  needsAck?: boolean = false;

  @ApiProperty({
    description: 'Whether the incident is already resolved at creation time (one-time incident)',
    default: false,
    required: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isResolved?: boolean = false;

  @ApiProperty({
    description: 'Idempotency key to prevent duplicate incidents',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}
