import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { Chain } from '@w3f/monitoring-types';

export class ResolveIncidentDto {
  @IsString()
  @IsNotEmpty()
  wallet: string;

  @IsString()
  @IsNotEmpty()
  handler: string;

  @IsEnum(Chain)
  chain: Chain;

  @IsString()
  @IsNotEmpty()
  groupId: string;

  @IsOptional()
  @IsString()
  resolvedMessage?: string;
}
