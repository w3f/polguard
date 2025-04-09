// TODO: The whole Telemetry feature is going to be removed in the future

import {
  MonitorType,
  HandlerExecutionType,
  TelemetryHandlerFunction,
  TelemetryHandlerParams,
  TelemetryMonitor,
  NoProvider,
} from '@w3f/monitoring-types';
import { AbstractMonitor } from '../common/abstract-monitor';

/**
 * Base monitor implementation for telemetry monitoring.
 * Provides methods for processing telemetry data.
 *
 * Telemetry monitors use a single type of handler:
 * - Telemetry handlers - executed periodically when telemetry data is fetched
 *
 * @typeParam T - Type of monitor (e.g., Telemetry)
 */
export abstract class AbstractTelemetryMonitor<T extends MonitorType>
  extends AbstractMonitor<T, NoProvider>
  implements TelemetryMonitor<T>
{
  protected getHandlerDefinitions(): Record<string, { type: HandlerExecutionType }> {
    return {
      telemetryHandlers: { type: 'periodic' }, // Executes on every telemetry fetch
    };
  }

  /**
   * Process telemetry data using registered handlers
   */
  async processTelemetry(params: TelemetryHandlerParams): Promise<void> {
    if (!this.handlers.has('telemetryHandlers')) {
      return;
    }

    const handlers = this.handlers.get('telemetryHandlers') as Set<TelemetryHandlerFunction>;
    for (const handler of handlers) {
      await handler.call(this, params);
    }
  }
}
