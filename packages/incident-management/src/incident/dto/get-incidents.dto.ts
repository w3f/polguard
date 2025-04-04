import { IsOptional, IsEnum, IsDateString, IsString } from 'class-validator';
import { Chain } from '@w3f/monitoring-types';

export class GetIncidentsDto {
  @IsOptional()
  @IsEnum(['open', 'acked', 'resolved', 'all'])
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
  groupName?: string;

  @IsOptional()
  @IsString()
  handlerName?: string;
}
