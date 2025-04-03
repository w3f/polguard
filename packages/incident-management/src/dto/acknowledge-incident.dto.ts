import { IsString, IsNotEmpty } from 'class-validator';

export class AcknowledgeIncidentDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  channelId: string;
}
