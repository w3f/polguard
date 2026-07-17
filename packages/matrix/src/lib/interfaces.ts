export interface PasswordAuth {
  password: string;
  recoveryKey?: string;
}

export interface TokenAuth {
  accessToken: string;
  deviceId: string;
}

export interface MatrixConfig {
  url: string;
  userId: string;
  logging: { level: 'trace' | 'debug' | 'info' | 'warn' | 'error' };
  pruneOtherDevices?: boolean;
  passwordAuth?: PasswordAuth;
  tokenAuth?: TokenAuth;
}

export type { IncidentResponse as Incident, NotificationResponse as Notification, GetIncidentsQuery } from '@w3f/polguard-common';
import type { IncidentResponse, GetIncidentsQuery } from '@w3f/polguard-common';

export interface IncidentServiceInterface {
  getNonResolved(roomId: string): Promise<IncidentResponse[]>;
  getNonAcked(roomId: string): Promise<IncidentResponse[]>;
  getIncidentById(incidentId: string): Promise<IncidentResponse>;
  acknowledgeIncident(incidentId: string, username: string, channelId: string): Promise<void>;
  resolveIncident(incidentId: string, username: string, channelId: string): Promise<void>;
  queryIncidents(roomId: string, filters: Partial<GetIncidentsQuery>): Promise<IncidentResponse[]>;
}
