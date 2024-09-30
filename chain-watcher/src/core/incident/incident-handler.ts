import { ChainWatcherStore } from '../store/chain-watcher-store';
import { IncidentEvent, AlertSettings, IncidentResolvedEvent } from '../interfaces';
import { createHash } from 'crypto';
import { Chain } from '../constants';

/**
 * IncidentHandler is responsible for managing and emitting incident events.
 * It handles both active (ongoing) incidents and instant (one-time) incidents.
 * For active incidents, it tracks their state and determines when they should be resolved.
 */
export class IncidentHandler {
  private readonly RESOLUTION_THRESHOLD = 3;

  constructor(
    private store: ChainWatcherStore,
    private chain: Chain
  ) {}

  async handleActiveIncident(
    incidentKey: string,
    isFiring: boolean,
    message: string,
    alerts: AlertSettings,
    blockNumber: number
  ): Promise<void> {
    const incidentId = this.generateIncidentId(incidentKey);
    
    if (isFiring) {
      const newIncident = await this.trackIncident(incidentId, message, alerts, blockNumber);
      if (newIncident) {
        await this.store.emitEvent(newIncident);
      }
    } else {
      const resolvedIncident = await this.checkResolution(incidentId, blockNumber);
      if (resolvedIncident) {
        await this.store.emitEvent(resolvedIncident);
      }
    }
  }

  async handleInstantIncident(
    incidentKey: string,
    message: string,
    alerts: AlertSettings,
    blockNumber: number
  ): Promise<void> {
    const incidentId = this.generateIncidentId(incidentKey);
    const incident: IncidentEvent = { id: incidentId, message, blockNumber, alerts, chain: this.chain };
    await this.store.emitEvent(incident);
  }

  private generateIncidentId(incidentKey: string): string {
    return createHash('md5').update(incidentKey).digest('hex').substring(0, 16);
  }

  private async trackIncident(
    incidentId: string,
    message: string,
    alerts: AlertSettings,
    blockNumber: number
  ): Promise<IncidentEvent | null> {
    const incidents = await this.store.getActiveIncidents();
    const existingState = incidents.get(incidentId);

    if (!existingState) {
      const newIncident: IncidentEvent = { id: incidentId, blockNumber, message, alerts, chain: this.chain };
      incidents.set(incidentId, {
        incident: newIncident,
        lastDetected: blockNumber,
        resolved: false,
        consecutiveNormalBlocks: 0,
      });
      await this.store.setActiveIncidents(incidents);
      return newIncident;
    }

    existingState.lastDetected = blockNumber;
    existingState.consecutiveNormalBlocks = 0;
    await this.store.setActiveIncidents(incidents);
    return null;
  }

  private async checkResolution(incidentId: string, blockNumber: number): Promise<IncidentResolvedEvent | null> {
    const incidents = await this.store.getActiveIncidents();
    const state = incidents.get(incidentId);
    if (!state || state.resolved) return null;

    state.consecutiveNormalBlocks++;

    if (state.consecutiveNormalBlocks >= this.RESOLUTION_THRESHOLD) {
      await this.store.deleteActiveIncident(incidentId, incidents);
      return {id: incidentId, blockNumber, alerts: state.incident.alerts, chain: this.chain};
    }

    await this.store.setActiveIncidents(incidents);
    return null;
  }
}
