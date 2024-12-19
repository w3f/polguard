export interface MatrixConfig {
  serverAddress: string;
  userId: string;
  password: string;
  logging: { level: 'trace' | 'debug' | 'info' | 'warn' | 'error' };
  rooms: { id: string; acknowledgement: boolean }[];
}

export interface Incident {
  id: string;
}

export interface IncidentServiceInterface {
  getNonAckedIncidentsForRoom(roomId: string): Promise<Incident[]>;
}
