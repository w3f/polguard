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

export interface ActiveIncidentState {
  incidentKey: string;
  consecutiveFiring: number;
  consecutiveNormal: number;
  lastEmitted: number;
  lastEmittedISOTime: string;
  message: Message;
}

export interface IncidentHandlerClient {
  oneTimeIncident(
    message: Message, 
    alerts: AlertSettings, 
    blockNumber?: number
  ): Promise<void>;
  ongoingIncident(
    message: Message,
    alerts: AlertSettings,
    key: string,
    isFiring: boolean,
    blockNumber?: number,
    threshold?: number,
  ): Promise<void>;
}
