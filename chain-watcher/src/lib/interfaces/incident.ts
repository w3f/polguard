import { Chain } from '../constants';

export interface AlertSettings {
  // TODO: Make matrix one of the enum values.
  matrix: {
    targets: string[];
    acknowledgement?: boolean;
  };
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
