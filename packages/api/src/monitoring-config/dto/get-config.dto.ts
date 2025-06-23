import { IsArray, IsString, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { Chain, MessengerType } from '@w3f/monitoring-types';
import { ApiProperty } from '@nestjs/swagger';

export class GetConfigDto {
  @ApiProperty({ enum: Chain, description: 'Blockchain network' })
  @IsEnum(Chain)
  chain: Chain;

  @ApiProperty({
    description: 'Comma-separated list of group IDs.',
    type: String,
    required: false,
  })
  @Transform(({ value }) => {
    if (!value) return [];
    if (typeof value === 'string') return value.split(',');
    return value;
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groupIds: string[] = [];

  @ApiProperty({ enum: MessengerType, description: 'Messenger type to filter by', required: false })
  @IsOptional()
  @IsEnum(MessengerType)
  messengerType?: MessengerType;

  @ApiProperty({ description: 'Channel ID to filter by', required: false })
  @IsOptional()
  @IsString()
  channelId?: string;
}
