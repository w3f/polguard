import { Chain } from '../constants';

export interface AlertSettings {
  matrix: {
    targets: string[];
    acknowledgement?: {
      escalation?: {
        timeout: number;
        targets: string[];
      };
    };
  };
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
