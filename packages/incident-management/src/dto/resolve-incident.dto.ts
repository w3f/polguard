import { IsString } from 'class-validator';

export class ResolveIncidentDto {
  @IsString()
  resolvedMessage: string;
}
