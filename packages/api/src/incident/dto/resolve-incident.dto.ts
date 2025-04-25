import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { Chain } from '@w3f/monitoring-types';
import { ApiProperty } from '@nestjs/swagger';

export class ResolveIncidentDto {
  @ApiProperty({
    description: 'Wallet address associated with the incident',
    example: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
  })
  @IsString()
  @IsNotEmpty()
  wallet: string;

  @ApiProperty({
    description: 'Handler that processed the incident',
    example: 'SlashReported',
  })
  @IsString()
  @IsNotEmpty()
  handler: string;

  @ApiProperty({
    description: 'Blockchain network',
    enum: Chain,
    example: 'Polkadot',
  })
  @IsEnum(Chain)
  chain: Chain;

  @ApiProperty({
    description: 'Monitoring group ID',
    example: 'validators-default',
  })
  @IsString()
  @IsNotEmpty()
  groupId: string;

  @ApiProperty({
    description: 'Optional message describing how the incident was resolved',
    example: 'Node is back online',
    required: true,
  })
  @IsString()
  resolvedMessage: string;
}
