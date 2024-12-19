import { Chain, MessengerType } from './constants';

export interface AlertSettings {
  messengerType: MessengerType;
  targets: string[];
  acknowledgement?: boolean;
  repeatIntervalHours?: number;
}

export interface IncidentEvent {
  id: string;
  blockNumber: number;
  chain: Chain;
  message: string;
  alerts: AlertSettings;
}

export interface Message {
  title: string;
  details: string[];
}

export interface ActiveIncidentState {
  incidentId: string;
  consecutiveFiringBlocks: number;
  consecutiveNormalBlocks: number;
  lastEmitted: number;
}

export interface IncidentHandlerClient {
  oneTimeIncident(message: Message, alerts: AlertSettings, blockNumber: number): Promise<void>;
  ongoingIncident(
    message: Message,
    alerts: AlertSettings,
    blockNumber: number,
    key: string,
    isFiring: boolean,
  ): Promise<void>;
}
