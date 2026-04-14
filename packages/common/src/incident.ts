import { Chain } from './constants';
import { MessengerType } from './notification';

export enum ResolutionType {
  ChainService = 'ChainService',
  AutoTimeout = 'AutoTimeout',
  Manual = 'Manual',
}

export interface NotificationSettings {
  messengerType: MessengerType;
  channels: string[];
  escalationChannels?: string[];
  escalationTimeoutMs?: number;
  needsAck?: boolean;
  repeatFiringMs?: number;
}

export interface NotificationChannel {
  channelId: string;
  messengerType: MessengerType;
  repeatFiringMs?: number;
}

export interface CreateIncidentDto {
  message: string;
  chain: Chain;
  blockNumber: number;
  account: string;
  groupId: string;
  handlerType: string;
  notificationChannels: NotificationChannel[];
  escalationChannels?: NotificationChannel[];
  escalationTimeoutMs?: number;
  needsAck?: boolean;
  isResolved?: boolean;
  idempotencyKey: string;
  eventIdx?: number;
  extrinsicIdx?: number;
}

export interface IncidentKey {
  groupId: string;
  handlerType: string;
  account?: string;
  token?: string;
}

export interface ResolveIncidentByChainDto {
  chain: Chain;
  blockNumber: number;
  resolutionMessage: string;
}

export interface ResolveIncidentManuallyDto {
  username: string;
  channelId: string;
}
