import {
  MonitorType,
  Message,
  HandlerExecutionType,
  TelemetryHandlerFunction,
  TelemetryHandlerParams,
  TelemetryMonitor,
  NoProvider,
  NodeInfo,
  MonitorHandlerType,
  AccountSettings,
  AlertSettings,
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

  /**
   * Helper method to iterate through all nodes for a given handler type.
   * Simplifies common pattern of iterating through unique addresses, their accounts, and nodes.
   *
   * @param handlerType - Type of handler to get accounts for
   * @param data - Telemetry data containing nodes by address
   * @param callback - Function to execute for each node
   */
  protected async forEachNode(
    handlerType: MonitorHandlerType[T],
    data: Record<string, NodeInfo[]>,
    callback: (params: {
      node: NodeInfo;
      account: AccountSettings<T>;
      alerts: AlertSettings;
      groupId: string;
    }) => Promise<void>,
  ): Promise<void> {
    for (const address of this.uniqueAddresses) {
      if (!data[address]) continue;
      for (const accountInfo of this.getAccounts(handlerType, address)) {
        for (const node of data[address]) {
          await callback({
            node,
            ...accountInfo,
          });
        }
      }
    }
  }

  /**
   * Creates a message with telemetry-specific details
   */
  protected createMessage(rows: string[]): Message {
    return { title: rows.shift(), details: rows };
  }
}
