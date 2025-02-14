import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import {
  Logger,
  IncidentEvent,
  AlertSettings,
  EventEmitterClient,
  Message,
  DataStoreClient,
  IncidentHandlerClient,
  Chain,
  MessageType,
  MessengerType,
} from '@w3f/monitoring-types';
import { MessageStyler } from './message-styler';

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
export class IncidentHandler implements IncidentHandlerClient {
  private readonly THRESHOLD = 3;
  private readonly DEFAULT_REPEAT_INTERVAL = 24 * 3600 * 1000; // 24 hours

  constructor(
    private logger: Logger,
    private store: DataStoreClient,
    private eventEmitter: EventEmitterClient,
    private chain: Chain,
  ) {}

  async ongoingIncident(
    message: Message,
    alerts: AlertSettings,
    incidentKey: string,
    isFiring: boolean,
    blockNumber?: number,
  ): Promise<void> {
    const incidentId = this.getIncidentId(incidentKey);
    let state = await this.store.getOngoingIncident(incidentId);
    if (!isFiring && !state) {
      return;
    }
    if (!state) {
      state = {
        incidentId,
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
        let repeatInterval = this.DEFAULT_REPEAT_INTERVAL;

        if (alerts.repeatIntervalHours !== undefined) {
          repeatInterval = alerts.repeatIntervalHours * 3600 * 1000;
        }

        const shouldEmit = state.lastEmitted === 0 || currentTimestamp - state.lastEmitted >= repeatInterval;

        if (shouldEmit) {
          await this.emitIncident(incidentId, message, alerts, MessageType.Firing, blockNumber);
          state.lastEmitted = currentTimestamp;
        }
      }
    } else {
      state.consecutiveNormalBlocks++;
      state.consecutiveFiringBlocks = 0;

      if (state.consecutiveNormalBlocks >= this.THRESHOLD) {
        await this.emitIncident(incidentId, message, alerts, MessageType.Resolved, blockNumber);
        await this.store.deleteOngoingIncident(incidentId);
        return;
      }
    }
    await this.store.setOngoingIncident(incidentId, state);
  }

  async oneTimeIncident(message: Message, alerts: AlertSettings, blockNumber?: number): Promise<void> {
    const incidentId = this.getIncidentId();
    await this.emitIncident(incidentId, message, alerts, MessageType.OneTime, blockNumber);
  }

  private async emitIncident(
    id: string,
    message: Message,
    alerts: AlertSettings,
    messageType: MessageType,
    blockNumber?: number,
  ): Promise<void> {
    const styledMessage = MessageStyler.applyStyle(message, messageType, MessengerType.Matrix);

    const incident: IncidentEvent = {
      id,
      chain: this.chain,
      message: styledMessage,
      alerts,
      blockNumber,
      timestamp: Date.now(),
    };

    this.logger.debug(`Emitting incident: ${JSON.stringify(incident)}`);

    const eventName = messageType === MessageType.Resolved ? 'incident.resolved' : 'incident.created';
    await this.eventEmitter.emit(eventName, incident);
  }

  private getIncidentId(incidentKey?: string): string {
    if (incidentKey) {
      return createHash('md5').update(incidentKey).digest('hex').substring(0, 16);
    }
    return uuidv4().replace(/-/g, '').substring(0, 16);
  }
}
