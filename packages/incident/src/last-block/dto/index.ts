import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLastBlockDto {
  @ApiProperty({ description: 'Block number' })
  @IsNumber()
  blockNumber: number;
}
