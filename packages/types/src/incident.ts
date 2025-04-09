import { Chain, MessengerType } from './constants';

export interface AlertSettings {
  messengerType: MessengerType;
  targets: string[];
  acknowledgement?: boolean;
  repeatIntervalHours?: number;
}

export interface IncidentEvent {
  id: string;
  chain: Chain;
  message: string;
  alerts: AlertSettings;
  timestamp: number;
  blockNumber?: number;
}

export interface Message {
  title: string;
  details: string[];
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
  oneTimeIncident(
    message: string[], 
    alerts: AlertSettings, 
    incidentKey: IncidentKey,
    blockNumber: number
  ): Promise<void>;
  ongoingIncident(
    message: string[],
    alerts: AlertSettings,
    isFiring: boolean,
    incidentKey: IncidentKey,
    blockNumber: number
  ): Promise<void>;
}
