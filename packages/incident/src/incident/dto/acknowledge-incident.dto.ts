import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcknowledgeIncidentDto {
  @ApiProperty({
    description: 'Username of the person acknowledging the incident',
    example: 'Alice',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'Channel ID where the acknowledgment is being made',
    example: '!testroom:matrix.org',
  })
  @IsString()
  @IsNotEmpty()
  channelId: string;
}
