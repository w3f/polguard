import { Chain, MessengerType } from './constants';

export interface NotificationSettings {
  messengerType: MessengerType;
  channels: string[];
  needsAck?: boolean;
  repeatHours?: number;
}

export interface NotificationChannel {
  channelId: string;
  messengerType: MessengerType;
  repeatHours?: number;
}

export interface CreateIncidentDto {
  message: string;
  chain: Chain;
  blockNumber: number;
  account: string;
  groupId: string;
  handlerType: string;
  notificationChannels: NotificationChannel[];
  needsAck?: boolean;
  isResolved?: boolean;
  idempotencyKey: string;
}

export interface IncidentKey {
  groupId: string;
  handlerType: string;
  account?: string;
  token?: string;
}

export interface IncidentHandlerClient {
  handle(
    message: string[],
    notifications: NotificationSettings,
    incidentKey: IncidentKey,
    blockNumber: number,
    isFiring?: boolean
  ): Promise<void>;
}
