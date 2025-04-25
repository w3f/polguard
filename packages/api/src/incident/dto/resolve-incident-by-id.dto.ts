import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResolveIncidentByIdDto {
  @ApiProperty({
    description: 'Optional message describing how the incident was resolved',
    example: 'Node is back online',
    required: true,
  })
  @IsString()
  resolvedMessage: string;
}
