import { Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { ChainWatcherStore } from '../store/chain-watcher-store';
import {
  IncidentEvent,
  AlertSettings,
  EventEmitterClient,
} from '../interfaces';
import { Chain } from '../constants';

/**
 * IncidentHandler is responsible for managing and emitting incident events.
 * It handles both ongoing incidents and one-time incidents.
 *
 * Key features:
 * - Tracks the state of ongoing incidents.
 * - Uses a threshold mechanism to determine when to emit or resolve incidents.
 * - Supports periodic re-emission of unresolved incidents.
 * - Handles one-time incidents.
 *
 * For ongoing incidents:
 * - An incident is emitted when it has been firing for a specified number of consecutive blocks (threshold).
 * - An incident is resolved when it has not been firing for the same number of consecutive blocks.
 * - Unresolved incidents are re-emitted at a specified interval.
 */
export class IncidentHandler {
  private readonly THRESHOLD = 3;

  constructor(
    private logger: Logger,
    private store: ChainWatcherStore,
    private eventEmitter: EventEmitterClient,
    private chain: Chain,
    private repeatInterval: number = 20000, // 20 sec
  ) {}

  async ongoingIncident(
    message: string,
    alerts: AlertSettings,
    blockNumber: number,
    incidentKey: string,
    isFiring: boolean,
  ): Promise<void> {
    const incidentId = this.getIncidentId(incidentKey);
    let state = await this.store.getOngoingIncident(incidentId);
    if (!isFiring && !state) {
      return
    }
    if (!state) {
      state = {
        incident: { id: incidentId, blockNumber, message, alerts, chain: this.chain },
        consecutiveFiringBlocks: 0,
        consecutiveNormalBlocks: 0,
        lastEmitted: 0,
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
          chain: this.chain,
        };
        await this.emitIncidentResolved(resolvedIncident);
        await this.store.deleteOngoingIncident(incidentId);
        return;
      }
    }
    await this.store.setOngoingIncident(incidentId, state);
  }

  async oneTimeIncident(
    message: string,
    alerts: AlertSettings,
    blockNumber: number,
  ): Promise<void> {
    const incidentId = this.getIncidentId();
    const incident: IncidentEvent = { id: incidentId, message, blockNumber, alerts, chain: this.chain};
    await this.emitIncident(incident);
  }

  private async emitIncident(event: IncidentEvent): Promise<void> {
    this.logger.debug(`Emitting incident.created: ${JSON.stringify(event)}`);
    await this.eventEmitter.emit('incident.created', event);
  }

  private async emitIncidentResolved(event: IncidentEvent): Promise<void> {
    this.logger.debug(`Emitting incident.resolved: ${JSON.stringify(event)}`);
    await this.eventEmitter.emit('incident.resolved', event);
  }

  private getIncidentId(incidentKey?: string): string {
    // TODO: check if truncation to 16 chars doesn't cause collisions
    if (incidentKey) {
      return createHash('md5')
        .update(incidentKey)
        .digest('hex')
        .substring(0, 16);
    }
    return uuidv4().replace(/-/g, '').substring(0, 16);
  }
}
