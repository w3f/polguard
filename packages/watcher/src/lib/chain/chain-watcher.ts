import { ApiPromise } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { CallBase } from '@polkadot/types/types/calls';
import { AnyTuple } from '@polkadot/types/types';

import { AbstractWatcher } from '../common/abstract-watcher';
import {
  ChainDataProvider,
  Logger,
  MetricsClient,
  MonitorConstructor,
  MonitoringGroup,
  IncidentHandlerClient,
  DataStoreClient,
  MonitorType,
  ChainProperties,
  ChainMonitor,
} from '@w3f/monitoring-types';

/**
 * ChainWatcher is responsible for monitoring blockchain activities and coordinating monitors.
 * It processes blocks sequentially and distributes events, calls, and block data to appropriate monitors.
 *
 * Key responsibilities:
 * 1. Block Processing
 *    - Subscribes to new finalized blocks
 *    - Processes blocks sequentially to ensure order
 *    - Tracks last processed block for continuity
 *
 * 2. Monitor Coordination
 *    - Executes periodic checks on every block
 *    - Distributes chain events to relevant monitors
 *    - Processes extrinsic calls including nested calls
 *
 * 3. State Management
 *    - Persists processing progress
 */
export class ChainWatcher extends AbstractWatcher<MonitorType, ChainMonitor<MonitorType>, ChainDataProvider> {
  private latestBlockNumber = 0;

  constructor(
    logger: Logger,
    monitoringGroups: MonitoringGroup[],
    private api: ApiPromise,
    incidents: IncidentHandlerClient,
    store: DataStoreClient,
    metrics: MetricsClient,
    provider: ChainDataProvider,
    chainProps: ChainProperties,
    monitorConfigs: [MonitorType, MonitorConstructor<MonitorType, ChainMonitor<MonitorType>, ChainDataProvider>][],
  ) {
    super(logger, monitoringGroups, incidents, store, metrics, chainProps, provider, monitorConfigs);
  }

  protected async startWatching(startBlock?: number): Promise<void> {
    if (this.monitors.length === 0) {
      throw new Error('No monitors were initialized for ChainWatcher.');
    }
    const header = await this.api.rpc.chain.getHeader();
    this.latestBlockNumber = header.number.toNumber();

    this.api.rpc.chain.subscribeFinalizedHeads(header => {
      const blockNumber = header.number.toNumber();
      this.latestBlockNumber = blockNumber;
    });

    this.runBlockProcessing(startBlock);
  }

  protected async stopWatching(): Promise<void> {
    await this.api.disconnect();
  }

  private async runBlockProcessing(startBlock?: number): Promise<void> {
    let nextBlockToProcess = startBlock ? startBlock : (await this.store.getLastProcessed('block')) + 1;

    while (this.isRunning) {
      if (nextBlockToProcess <= this.latestBlockNumber) {
        await this.processBlock(nextBlockToProcess);
        nextBlockToProcess++;
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async processBlock(blockNumber: number): Promise<void> {
    this.logger.debug(`Processing block: #${blockNumber}`);
    const blockHash = await this.api.rpc.chain.getBlockHash(blockNumber);
    const block = await this.api.rpc.chain.getBlock(blockHash);
    const apiAt = await this.api.at(blockHash);

    // Apply every block handlers: process custom logic, usually storage calls
    for (const monitor of this.monitors) {
      await monitor.processState({ blockNumber });
    }

    // Apply event handlers: process event payload
    await apiAt.query.system.events(async (records: EventRecord[]) => {
      for (const eventRecord of records) {
        for (const monitor of this.monitors) {
          await monitor.processEvent({ blockNumber, eventRecord });
        }
      }
    });

    // Apply call handlers: process call signature
    for (let extrinsicIndex = 0; extrinsicIndex < block.block.extrinsics.length; extrinsicIndex++) {
      const extrinsic = block.block.extrinsics[extrinsicIndex];
      const origin = extrinsic.signer.toString();
      await this.processCallTree(blockNumber, extrinsic.method, origin, extrinsicIndex);
    }

    await this.store.setLastProcessed('block', blockNumber);
    this.metrics.setBlockHeight(blockNumber);
  }

  private async processCallTree(
    blockNumber: number,
    call: CallBase<AnyTuple>,
    origin: string,
    extrinsicIndex: number,
  ): Promise<void> {
    // Process the current call
    for (const monitor of this.monitors) {
      await monitor.processCall({ blockNumber, call, origin, extrinsicIndex });
    }

    // Process nested calls
    for (const arg of call.args) {
      if (arg && typeof arg === 'object' && 'callIndex' in arg) {
        await this.processCallTree(blockNumber, arg as CallBase<AnyTuple>, origin, extrinsicIndex);
      } else if (Array.isArray(arg)) {
        for (const subArg of arg) {
          if (subArg && typeof subArg === 'object' && 'callIndex' in subArg) {
            await this.processCallTree(blockNumber, subArg as CallBase<AnyTuple>, origin, extrinsicIndex);
          }
        }
      }
    }
  }
}
