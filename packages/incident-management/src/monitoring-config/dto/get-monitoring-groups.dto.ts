import { IsArray, ArrayNotEmpty, IsString, IsEnum } from 'class-validator';
import { Chain } from '@w3f/monitoring-types';

export class GetMonitoringGroupsDto {
  @IsEnum(Chain)
  chain: Chain;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  groupIds: string[];
}
