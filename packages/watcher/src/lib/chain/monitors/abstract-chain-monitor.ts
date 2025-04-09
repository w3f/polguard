import { Phase } from '@polkadot/types/interfaces';
import {
  ChainDataProvider,
  CallHandlerParams,
  EventHandlerParams,
  StateHandlerParams,
  MonitorType,
  AccountId,
  HandlerExecutionType,
  ChainMonitor,
  EventHandlerFunction,
  CallHandlerFunction,
  StateHandlerFunction,
} from '@w3f/monitoring-types';
import { formatBalance } from '@polkadot/util';
import { AbstractMonitor } from '../../common/abstract-monitor';

/**
 * Base monitor implementation for chain-specific monitoring.
 * Provides methods for processing chain events, calls, and blocks.
 *
 * Chain monitors use three types of handlers:
 * 1. Event handlers - triggered by specific chain events
 * 2. Call handlers - triggered by specific extrinsic calls
 * 3. Block handlers - executed periodically on every block
 *
 * @typeParam T - Type of monitor (e.g., Staking, Identity)
 */
export abstract class AbstractChainMonitor<T extends MonitorType>
  extends AbstractMonitor<T, ChainDataProvider>
  implements ChainMonitor<T>
{
  protected getHandlerDefinitions(): Record<string, { type: HandlerExecutionType }> {
    return {
      eventHandlers: { type: 'triggered' }, // Executes on specific events
      callHandlers: { type: 'triggered' }, // Executes on specific calls
      stateHandlers: { type: 'periodic' }, // Executes on every block
    };
  }

  /**
   * Process a chain event if there's a matching handler
   */
  async processEvent({ eventRecord, blockNumber }: EventHandlerParams): Promise<void> {
    if (!this.handlers.has('eventHandlers')) {
      return;
    }

    const { event } = eventRecord;
    const eventName = `${event.section}.${event.method}`;
    const handlers = this.handlers.get('eventHandlers') as Map<string, EventHandlerFunction>;
    const handler = handlers.get(eventName);
    if (handler) {
      await handler.call(this, { eventRecord, blockNumber });
    }
  }

  /**
   * Process a chain call if there's a matching handler
   */
  async processCall({ call, origin, blockNumber, extrinsicIndex }: CallHandlerParams): Promise<void> {
    if (!this.handlers.has('callHandlers')) {
      return;
    }

    const callName = `${call.section}.${call.method}`;
    const handlers = this.handlers.get('callHandlers') as Map<string, CallHandlerFunction>;
    const handler = handlers.get(callName);
    if (handler) {
      await handler.call(this, { call, origin, blockNumber, extrinsicIndex });
    }
  }

  /**
   * Process periodic state checks using registered handlers
   */
  async processState(params: StateHandlerParams): Promise<void> {
    if (!this.handlers.has('stateHandlers')) {
      return;
    }

    const handlers = this.handlers.get('stateHandlers') as Set<StateHandlerFunction>;
    for (const handler of handlers) {
      await handler.call(this, params);
    }
  }

  /**
   * Creates a subscan link for the event
   */
  protected getEventLink(blockNumber: number, phase: Phase): string {
    if (!phase.isApplyExtrinsic) {
      this.logger.warn(`Unable to generate event link: Phase is not ApplyExtrinsic in block ${blockNumber}`);
      return '';
    }
    const index = phase.asApplyExtrinsic.toNumber();
    return `https://${this.chainProps.specName}.subscan.io/event?extrinsic=${blockNumber}-${index}`;
  }

  /**
   * Creates a subscan link for the account
   */
  protected getAccountLink(address: string): string {
    return `https://${this.chainProps.specName}.subscan.io/account/${address}`;
  }

  /**
   * Creates a subscan link for the extrinsic
   */
  protected getExtrinsicLink(blockNumber: number, extrinsicIndex: number): string {
    return `https://${this.chainProps.specName}.subscan.io/extrinsic/${blockNumber}-${extrinsicIndex}`;
  }

  /**
   * Creates a formatted link for an account with its name
   */
  protected formatAccountLink(account: AccountId): string {
    return this.formatLink(account.name, this.getAccountLink(account.ss58));
  }

  /**
   * Creates a message with chain-specific details (block number, event/extrinsic links)
   */
  protected createMessage(
    rows: string[],
    options?: {
      blockNumber: number;
      phase?: Phase;
      extrinsicIndex?: number;
      address?: string;
    },
  ): string[] {
    if (options) {
      rows.push(`Block: ${options.blockNumber}`);
      if (options.phase !== undefined) {
        rows.push(`Event: ${this.getEventLink(options.blockNumber, options.phase)}`);
      } else if (options.extrinsicIndex !== undefined) {
        rows.push(`Extrinsic: ${this.getExtrinsicLink(options.blockNumber, options.extrinsicIndex)}`);
      }
    }
    rows.push(`Network: ${this.chainProps.chain}`);
    return rows;
  }

  /**
   * Formats balance according to chain specifications
   */
  protected formatBalance(amount: number | string | bigint): string {
    return formatBalance(amount, {
      decimals: this.chainProps.chainDecimals,
      withUnit: this.chainProps.chainToken,
      withSi: true,
      forceUnit: '-',
    });
  }
}
