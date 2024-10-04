import { ChainWatcherStore } from '../store/chain-watcher-store';
import { IncidentEvent, AlertSettings, EventEmitterClient } from '../interfaces';
import { createHash } from 'crypto';
import { Chain } from '../constants';

/**
 * IncidentHandler is responsible for managing and emitting incident events.
 * It handles both ongoing incidents and one-time incidents.
 * 
 * Key features:
 * 1. Tracks the state of ongoing incidents.
 * 2. Uses a threshold mechanism to determine when to emit or resolve incidents.
 * 3. Supports periodic re-emission of unresolved incidents.
 * 4. Handles one-time incidents.
 * 
 * For ongoing incidents:
 * - An incident is emitted when it has been firing for a specified number of consecutive blocks (threshold).
 * - An incident is resolved when it has not been firing for the same number of consecutive blocks.
 * - Unresolved incidents are re-emitted at a specified interval.
 */
export class IncidentHandler {
  private readonly THRESHOLD = 3;

  constructor(
    private store: ChainWatcherStore,
    private eventEmitter: EventEmitterClient,
    private chain: Chain,
    private repeatInterval: number = 6
  ) {}

  async handleOngoingIncident(
    incidentKey: string,
    isFiring: boolean,
    message: string,
    alerts: AlertSettings,
    blockNumber: number
  ): Promise<void> {
    const incidentId = this.generateIncidentId(incidentKey);
    let state = await this.store.getOngoingIncident(incidentId);
    if (!state) {
      state = {
        incident: { id: incidentId, blockNumber, message, alerts, chain: this.chain },
        consecutiveFiringBlocks: 0,
        consecutiveNormalBlocks: 0,
        lastEmitted: 0
      };
    }

    if (isFiring) {
      const currentTimestamp = Date.now();
      state.consecutiveFiringBlocks++;
      state.consecutiveNormalBlocks = 0;

      if (state.consecutiveFiringBlocks >= this.THRESHOLD) {
        const shouldEmit = state.lastEmitted === 0 || (currentTimestamp - state.lastEmitted >= this.repeatInterval);
        
        if (shouldEmit) {
          await this.emitIncident(state.incident);
          state.lastEmitted = currentTimestamp;
        }
      }
    } else {
      state.consecutiveNormalBlocks++;
      state.consecutiveFiringBlocks = 0;

      if (state.consecutiveNormalBlocks >= this.THRESHOLD) {
        const resolvedIncident: IncidentEvent = {
          id: incidentId,
          blockNumber,
          message: `Incident resolved: ${incidentId}`,
          alerts: state.incident.alerts,
          chain: this.chain
        };
        await this.emitIncidentResolved(resolvedIncident);
        await this.store.deleteOngoingIncident(incidentId);
        return;
      }
    }
    await this.store.setOngoingIncident(incidentId, state);
  }

  async handleOneTimeIncident(
    incidentKey: string,
    message: string,
    alerts: AlertSettings,
    blockNumber: number
  ): Promise<void> {
    const incidentId = this.generateIncidentId(incidentKey);
    const incident: IncidentEvent = { id: incidentId, message, blockNumber, alerts, chain: this.chain };
    await this.emitIncident(incident);
  }

  private async emitIncident(event: IncidentEvent): Promise<void> {
    this.eventEmitter.emit('incident', event);
  }

  private async emitIncidentResolved(event: IncidentEvent): Promise<void> {
    this.eventEmitter.emit('incident-resolved', event);
  }

  private generateIncidentId(incidentKey: string): string {
    return createHash('md5').update(incidentKey).digest('hex').substring(0, 16);
  }
}
