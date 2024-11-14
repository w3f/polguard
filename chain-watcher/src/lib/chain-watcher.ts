import { ApiPromise } from '@polkadot/api';
import type { EventRecord } from '@polkadot/types/interfaces/system';
import { AnyTuple } from '@polkadot/types/types';
import { CallBase } from '@polkadot/types/types/calls';

import {
  ChainProperties,
  MetricsClient,
  Logger,
  Monitor,
  MonitorConstructor,
  MonitoringGroup,
  StateQueryProvider,
  DataStoreClient,
} from './interfaces';
import { MonitorType } from './constants';
import { IncidentHandler } from './incident/incident-handler';
import { GovernanceMonitor } from './monitors/governance/governance-monitor';
import { TransactionEgressMonitor, TransactionIngressMonitor } from './monitors/transaction/transaction-monitor';
import { ValidatorMonitor } from './monitors/validator/validator-monitor';
import { BalanceDecrementMonitor, BalanceIncrementMonitor } from './monitors/balance/balance-monitor';
import { BalanceThresholdMonitor } from './monitors/balance/balance-threshold-monitor';

/**
 * ChainWatcher is the core class responsible for monitoring a blockchain.
 * It orchestrates the process of watching new blocks, initializing and managing various monitors,
 * and coordinating the processing of blockchain events.
 *
 * Key responsibilities:
 * 1. Initializing and managing different types of monitors (e.g., Governance, Validator, Transaction).
 * 2. Subscribing to new finalized blocks from the blockchain.
 * 3. Coordinating the processing of each block and its events across all active monitors.
 * 4. Managing the state of the last processed block to ensure continuity across restarts.
 * 5. Providing start and stop functionality for the watching process.
 *
 * The class works in conjunction with:
 * - ApiPromise: For interacting with the blockchain.
 * - IncidentHandler: For managing and emitting incident events.
 * - ChainWatcherStore: For persisting state and emitting events.
 * - Various Monitor classes: For implementing specific monitoring logic.
 *
 * Usage:
 * 1. Instantiate with necessary dependencies (logger, monitoring groups, API, incident handler, and store).
 * 2. Call start() to begin the watching process.
 * 3. Call stop() to halt the watching process when needed.
 */
export class ChainWatcher {
  private latestBlockNumber: number = 0;
  private isRunning: boolean = false;
  protected monitors: Monitor[] = [];

  constructor(
    private logger: Logger,
    private monitoringGroups: MonitoringGroup[],
    private api: ApiPromise,
    // TODO: interface for the incident handler
    private incidents: IncidentHandler,
    private store: DataStoreClient,
    private metrics: MetricsClient,
    private stateQuery: StateQueryProvider,
    private chainProps: ChainProperties,
  ) {
    this.initializeMonitors();
  }

  private initializeMonitors(): void {
    const monitorConfigs: [MonitorType, MonitorConstructor][] = [
      [MonitorType.Governance, GovernanceMonitor],
      [MonitorType.Validator, ValidatorMonitor],
      [MonitorType.TransactionIngress, TransactionIngressMonitor],
      [MonitorType.TransactionEgress, TransactionEgressMonitor],
      [MonitorType.BalanceDecrement, BalanceDecrementMonitor],
      [MonitorType.BalanceIncrement, BalanceIncrementMonitor],
      [MonitorType.BalanceThreshold, BalanceThresholdMonitor],
    ];

    this.monitors = monitorConfigs.flatMap(([monitorType, MonitorClass]) => {
      const groups = this.monitoringGroups.filter(group =>
        group.monitors.some(monitor => monitor.name === monitorType),
      );
      if (groups.length > 0) {
        this.logger.debug(`${monitorType} monitor initialized with ${groups.length} groups`);
        return [new MonitorClass(this.logger, groups, this.incidents, this.stateQuery, this.chainProps, monitorType)];
      }
      return [];
    });
  }

  async start(startBlock?: number): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('ChainWatcher has already been started.');
      return;
    }

    // Initialize the latest block number
    const header = await this.api.rpc.chain.getHeader();
    this.latestBlockNumber = header.number.toNumber();

    this.api.rpc.chain.subscribeFinalizedHeads(header => {
      const blockNumber = header.number.toNumber();
      this.latestBlockNumber = blockNumber;
    });
    this.isRunning = true;
    this.runBlockProcessing(startBlock);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.api.disconnect();
  }

  async getLastProcessedBlock(): Promise<number> {
    const storedBlock = await this.store.getLastProcessedBlock();
    if (storedBlock !== null) {
      return storedBlock;
    }
    const startBlock = Math.max(0, this.latestBlockNumber - 1);
    this.logger.log(`No stored last processed block. Starting from block: ${startBlock}`);
    return startBlock;
  }

  private async setLastProcessedBlock(block: number): Promise<void> {
    await this.store.setLastProcessedBlock(block);
  }

  private async runBlockProcessing(startBlock?: number): Promise<void> {
    this.logger.log(`Start processing from block: #${startBlock || '<NOT_PROVIDED>'}`);
    let nextBlockToProcess = startBlock ? startBlock : (await this.getLastProcessedBlock()) + 1;

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
      await monitor.processEveryBlock({ blockNumber });
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

    await this.setLastProcessedBlock(blockNumber);
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
