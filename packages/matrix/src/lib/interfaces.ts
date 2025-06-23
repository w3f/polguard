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

export interface Notification {
  id: number;
  incidentId: string;
  channelId: string;
  messengerType: string;
  type: string;
  repeatHours: number;
  lastSentAt?: Date;
  isDelivered: boolean;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Incident {
  id: string;
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
  notifications?: Notification[];
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
  getIncidentById(incidentId: string): Promise<Incident>;
  acknowledgeIncident(incidentId: string, username: string, channelId: string): Promise<void>;
  queryIncidents(roomId: string, filters: QueryFilters): Promise<Incident[]>;
}
