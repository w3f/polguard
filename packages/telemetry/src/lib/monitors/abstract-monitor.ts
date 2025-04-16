import {
  ChainProperties,
  IncidentHandlerClient,
  Logger,
  MonitoringGroup,
  MonitorType,
  TelemetryHandlerFunction,
  TelemetryHandlerParams,
  TelemetryMonitor,
} from '@w3f/monitoring-types';
import { AccountRegistry } from '../account-registry';

/**
 * Base class for all chain monitors in the monitoring platform.
 * Provides common infrastructure for handler management and chain-specific processing.
 *
 * Chain monitors use three types of handlers:
 * 1. Event handlers - triggered by specific chain events
 * 2. Call handlers - triggered by specific extrinsic calls
 * 3. State handlers - executed periodically on every block
 *
 * @typeParam T - Type of monitor
 */
export abstract class AbstractMonitor<T extends MonitorType> implements TelemetryMonitor {
  protected handlers = {
    telemetry: new Set<TelemetryHandlerFunction>(),
  };
  protected reg: AccountRegistry<T>;

  constructor(
    protected logger: Logger,
    protected groups: MonitoringGroup[],
    protected incidents: IncidentHandlerClient,
    protected chainProps: ChainProperties,
    protected monitorType: T,
  ) {
    this.reg = new AccountRegistry<T>(groups, monitorType);
    this.initializeHandlers();
  }

  /**
   * Initializes all handlers for the monitor.
   *
   * For each handler type:
   * 1. Binds handler methods to the instance
   * 2. Stores handlers in the appropriate collection
   * 3. Only includes handlers that are supported for the current chain
   */
  private initializeHandlers(): void {
    const prototype = Object.getPrototypeOf(this);

    for (const [_, metadata] of prototype.state) {
      if (typeof this[metadata.method] === 'function' && metadata.chains.includes(this.chainProps.chain)) {
        const handler = this[metadata.method].bind(this);
        this.handlers.telemetry.add(handler);
      }
    }
  }

  async processTelemetry(params: TelemetryHandlerParams): Promise<void> {
    for (const handler of this.handlers.telemetry) {
      await handler.call(this, params);
    }
  }
}
