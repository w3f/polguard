import { Chain, MessengerType } from './constants';

export interface AlertSettings {
  messengerType: MessengerType;
  targets: string[];
  acknowledgement?: boolean;
  repeatIntervalHours?: number;
}

export interface CreateIncidentDto {
  message: string;
  chain: Chain;
  blockNumber: number;
  wallet: string;
  groupId: string;
  handler: string;
  channelId: string;
  messengerType: MessengerType;
  ackRequired?: boolean;
  repeatIntervalHours?: number;
  resolved?: boolean;
}

export interface ResolveIncidentDto {
  chain: Chain;
  groupId: string;
  handler: string;
  wallet: string;
  resolvedMessage?: string;
}

export interface IncidentKey {
  groupId: string;
  wallet: string;
  handler: string;
}

export interface IncidentHandlerClient {
  handle(
    message: string[],
    alerts: AlertSettings,
    incidentKey: IncidentKey,
    blockNumber: number,
    isFiring?: boolean
  ): Promise<void>;
}