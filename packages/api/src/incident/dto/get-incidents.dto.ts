import { IsOptional, IsEnum, IsDateString, IsString, IsBoolean } from 'class-validator';
import { Chain, MessengerType } from '@w3f/monitoring-types';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class GetIncidentsDto {
  @ApiProperty({
    description: 'Filter incidents created after this date (ISO format), ex. 2025-04-20T00:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @ApiProperty({
    description: 'Filter incidents created before this date (ISO format), ex. 2025-04-24T23:59:59Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  createdBefore?: string;

  @ApiProperty({
    description: 'Filter incidents by blockchain network',
    enum: Chain,
    required: false,
  })
  @IsOptional()
  @IsEnum(Chain)
  chain?: Chain;

  @ApiProperty({
    description: 'Filter incidents by account address, ex. 15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
    required: false,
  })
  @IsOptional()
  @IsString()
  account?: string;

  @ApiProperty({
    description: 'Filter incidents by monitoring group ID, ex. validators-default',
    required: false,
  })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiProperty({
    description: 'Filter incidents by handler type, ex. SlashReported',
    required: false,
  })
  @IsOptional()
  @IsString()
  handlerType?: string;

  @ApiProperty({
    description: 'Filter incidents by channel ID, ex. !testroom:matrix.org',
    required: false,
  })
  @IsOptional()
  @IsString()
  channelId?: string;

  @ApiProperty({
    description: 'Filter incidents by messenger type',
    enum: MessengerType,
    required: false,
  })
  @IsOptional()
  @IsEnum(MessengerType)
  messengerType?: MessengerType;

  @ApiProperty({
    description: 'Filter incidents by whether acknowledgment is required',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  needsAck?: boolean;

  @ApiProperty({
    description: 'Filter incidents by acknowledgment status',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  isAcked?: boolean;

  @ApiProperty({
    description: 'Filter incidents by resolution status',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  isResolved?: boolean;
}
