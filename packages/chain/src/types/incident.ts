import { NotificationSettings, IncidentKey, IncidentContent, CreateIncidentBody, ResolveByChainBody } from '../types';

export interface BlockContext {
  blockNumber: number; // always set
  eventIdx?: number; // set for event handlers
  extrinsicIdx?: number; // set for call handlers
  callIdx?: number; // set for call handlers (leaf call inside an extrinsic)
}

export interface IncidentHandlerClient {
  handle(
    content: IncidentContent,
    notifications: NotificationSettings,
    incidentKey: IncidentKey,
    blockContext: BlockContext,
    isFiring?: boolean,
  ): Promise<void>;
}

export interface IncidentReporter {
  createIncident(incident: CreateIncidentBody): Promise<string>;
  resolveIncident(id: string, resolveData: ResolveByChainBody): Promise<void>;
}
