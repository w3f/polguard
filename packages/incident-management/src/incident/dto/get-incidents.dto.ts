import { IsOptional, IsEnum, IsDateString, IsString, IsBoolean } from 'class-validator';
import { Chain } from '@w3f/monitoring-types';

export class GetIncidentsDto {
  @IsOptional()
  @IsEnum(['open', 'acked', 'unacked', 'resolved', 'all'])
  status?: string = 'all';

  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @IsOptional()
  @IsDateString()
  createdBefore?: string;

  @IsOptional()
  @IsEnum(Chain)
  chain?: Chain;

  @IsOptional()
  @IsString()
  wallet?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  handler?: string;

  @IsOptional()
  @IsString()
  channelId?: string;

  @IsOptional()
  @IsBoolean()
  ackRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  acked?: boolean;

  @IsOptional()
  @IsBoolean()
  resolved?: boolean;
}
