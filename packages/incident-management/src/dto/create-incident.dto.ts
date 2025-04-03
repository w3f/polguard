import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Chain, MessengerType } from '@w3f/monitoring-types';

export class CreateIncidentDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(Chain)
  chain: Chain;

  @IsOptional()
  @IsNumber()
  blockNumber?: number;

  @IsString()
  @IsNotEmpty()
  wallet: string;

  @IsString()
  @IsNotEmpty()
  groupName: string;

  @IsString()
  @IsNotEmpty()
  handlerName: string;

  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsEnum(MessengerType)
  messengerType: MessengerType;

  @IsOptional()
  @IsBoolean()
  ackRequired?: boolean = false;

  @IsOptional()
  @IsNumber()
  repeatIntervalHours?: number;

  @IsOptional()
  @IsBoolean()
  resolved?: boolean = false;
}
