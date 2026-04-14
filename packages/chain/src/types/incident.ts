import { NotificationSettings, IncidentKey, CreateIncidentDto, ResolveIncidentByChainDto } from '../types';

export interface BlockContext {
  blockNumber: number; // always set
  eventIdx?: number; // set for event handlers
  extrinsicIdx?: number; // set for call handlers
  callIdx?: number; // set for call handlers (leaf call inside an extrinsic)
}

export interface IncidentHandlerClient {
  handle(
    message: string[],
    notifications: NotificationSettings,
    incidentKey: IncidentKey,
    blockContext: BlockContext,
    isFiring?: boolean,
  ): Promise<void>;
}

export interface IncidentReporter {
  createIncident(incident: CreateIncidentDto): Promise<string | null>;
  resolveIncident(id: string, resolveData: ResolveIncidentByChainDto): Promise<void>;
}
