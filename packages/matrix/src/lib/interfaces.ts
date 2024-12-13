import { MessengerType } from './constants';

export interface MatrixConfig {
  serverAddress: string;
  userId: string;
  password: string;
  logging: { level: 'trace' | 'debug' | 'info' | 'warn' | 'error' };
  rooms: { id: string; acknowledgement: boolean }[];
}

export interface IncidentEvent {
  id: string;
  blockNumber: number;
  chain: string;
  message: string;
  alerts: AlertSettings;
}

export interface AlertSettings {
  messengerType: MessengerType;
  targets: string[];
  acknowledgement?: boolean;
  repeatIntervalHours?: number;
}

export interface Incident {
  id: string;
}

export interface IncidentServiceInterface {
  getNonAckedIncidentsForRoom(roomId: string): Promise<Incident[]>;
}

export interface Logger {
  log(message: string): void;
  error(message: string): void;
  warn(message: string): void;
  debug(message: string): void;
  verbose(message: string): void;
  fatal(message: string): void;
}
