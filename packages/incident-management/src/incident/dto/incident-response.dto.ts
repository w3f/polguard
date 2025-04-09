import { Chain } from '@w3f/monitoring-types';

export class IncidentResponseDto {
  id: number;
  message: string;
  blockNumber?: number;
  chain: Chain;
  wallet: string;
  groupId: string;
  handler: string;
  channelId: string;
  ackRequired: boolean;
  acked: boolean;
  ackedByUser?: string;
  ackedAt?: Date;
  repeatIntervalHours?: number;
  resolved: boolean;
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}
