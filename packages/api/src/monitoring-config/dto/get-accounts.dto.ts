import { IsArray, ArrayNotEmpty, IsString, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { Chain } from '@w3f/monitoring-types';

export class GetAccountsDto {
  @IsEnum(Chain)
  chain: Chain;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',');
    }
    return value;
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  groupIds: string[];
}
