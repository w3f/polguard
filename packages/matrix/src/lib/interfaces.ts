export interface MatrixConfig {
  serverAddress: string;
  userId: string;
  password: string;
  logging: { level: 'trace' | 'debug' | 'info' | 'warn' | 'error' };
  rooms: { id: string; acknowledgement: boolean }[];
}

export interface Incident {
  id: number;
  message: string;
  chain: string;
  groupId: string;
  handlerName: string;
  wallet: string;
  ackRequired: boolean;
  acked: boolean;
  ackedByUser?: string;
  ackedAt?: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedMessage?: string;
  createdAt: Date;
}

export interface IncidentServiceInterface {
  getNonResolved(roomId: string): Promise<Incident[]>;
  getNonAcked(roomId: string): Promise<Incident[]>;
  getIncidentById(incidentId: number): Promise<Incident>;
  acknowledgeIncident(incidentId: number, username: string, channelId: string): Promise<void>;
}
