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

export interface IncidentKey {
  groupId: string;
  handlerType: string;
  account?: string;
  token?: string;
}
