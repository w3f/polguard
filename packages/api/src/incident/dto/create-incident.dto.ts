import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Chain, MessengerType } from '@w3f/monitoring-types';
import { ApiProperty } from '@nestjs/swagger';

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
    description: 'Wallet address associated with the incident',
    example: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
  })
  @IsString()
  @IsNotEmpty()
  wallet: string;

  @ApiProperty({
    description: 'Monitoring group ID that the incident belongs to',
    example: 'validators-default',
  })
  @IsString()
  @IsNotEmpty()
  groupId: string;

  @ApiProperty({
    description: 'Handler that detected the incident',
    example: 'SlashReported',
  })
  @IsString()
  @IsNotEmpty()
  handler: string;

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
    description: 'Whether the incident requires acknowledgment',
    default: false,
    required: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  ackRequired?: boolean = false;

  @ApiProperty({
    description: 'Interval in hours for repeating notifications if the incident remains unresolved',
    required: false,
    example: 24,
  })
  @IsOptional()
  @IsNumber()
  repeatIntervalHours?: number;

  @ApiProperty({
    description: 'Whether the incident is already resolved at creation time (one-time incident)',
    default: false,
    required: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  resolved?: boolean = false;
}
