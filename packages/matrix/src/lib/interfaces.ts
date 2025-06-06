export interface PasswordAuth {
  password: string;
}

export interface TokenAuth {
  accessToken: string;
  deviceId: string;
}

export interface MatrixConfig {
  url: string;
  userId: string;
  logging: { level: 'trace' | 'debug' | 'info' | 'warn' | 'error' };
  rooms: { id: string; acknowledgement: boolean }[];
  enableEncryption?: boolean;

  // One of these must be provided
  passwordAuth?: PasswordAuth;
  tokenAuth?: TokenAuth;
}

export interface Incident {
  id: number;
  message: string;
  blockNumber: number;
  chain: string;
  account: string;
  groupId: string;
  handlerType: string;
  needsAck: boolean;
  isAcked: boolean;
  ackedBy?: string;
  ackedAt?: Date;
  isResolved: boolean;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueryFilters {
  status?: string;
  createdAfter?: string;
  createdBefore?: string;
  chain?: string;
  account?: string;
  groupId?: string;
  handlerType?: string;
  needsAck?: boolean;
  isAcked?: boolean;
  isResolved?: boolean;
}

export interface IncidentServiceInterface {
  getNonResolved(roomId: string): Promise<Incident[]>;
  getNonAcked(roomId: string): Promise<Incident[]>;
  getIncidentById(incidentId: number): Promise<Incident>;
  acknowledgeIncident(incidentId: number, username: string, channelId: string): Promise<void>;
  queryIncidents(roomId: string, filters: QueryFilters): Promise<Incident[]>;
}
