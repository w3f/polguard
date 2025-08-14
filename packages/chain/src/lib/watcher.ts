import { CallBase } from '@polkadot/types/types/calls';
import { AnyTuple } from '@polkadot/types/types';
import { EventRecord } from '@polkadot/types/interfaces';

import {
  Logger,
  IncidentHandlerClient,
  KeyValueStorageClient,
  MonitoringGroup,
  ChainProperties,
  MonitorType,
  MonitorConstructor,
  ChainDataProvider,
  MonitoringConfigClient,
  Monitor,
  ChainApiClient,
  LastBlockClient,
} from '@w3f/monitoring-types';
import {
  IdentityMonitor,
  BalancesMonitor,
  GovernanceMonitor,
  StakingMonitor,
  XcmMonitor,
  AssetsMonitor,
} from './monitors';

/**
 * ChainWatcher is responsible for monitoring blockchain activities and coordinating monitors.
 * It processes blocks sequentially and distributes events, calls, and block data to appropriate monitors.
 *
 * Key responsibilities:
 * 1. Monitor Management
 *    - Initializes configured monitors
 *    - Periodically refreshes monitoring configuration
 *
 * 2. Lifecycle Management
 *    - Controls watcher's running state
 *    - Handles startup and shutdown
 *
 * 3. Block Processing
 *    - Subscribes to new finalized blocks
 *    - Processes blocks sequentially to ensure order
 *    - Tracks last processed block for continuity
 *
 * 4. Monitor Coordination
 *    - Executes periodic checks on every block
 *    - Distributes chain events to relevant monitors
 *    - Processes extrinsic calls including nested calls
 *
 * 5. State Management
 *    - Persists processing progress
 */
export class ChainWatcher {
  monitors: Monitor[] = [];
  private isRunning = false;
  private readonly configRefreshIntervalMs = 15 * 60 * 1000; // 15 minutes
  private latestBlockNumber = 0;

  private static readonly monitorConfigs: [MonitorType, MonitorConstructor<MonitorType>][] = [
    [MonitorType.Governance, GovernanceMonitor],
    [MonitorType.Staking, StakingMonitor],
    [MonitorType.Balances, BalancesMonitor],
    [MonitorType.Identity, IdentityMonitor],
    [MonitorType.Xcm, XcmMonitor],
    [MonitorType.Assets, AssetsMonitor],
  ];

  constructor(
    private logger: Logger,
    private monitoringConfigClient: MonitoringConfigClient,
    private lastBlockClient: LastBlockClient,
    private api: ChainApiClient,
    private incidents: IncidentHandlerClient,
    private store: KeyValueStorageClient,
    private chainProps: ChainProperties,
    private chainProvider: ChainDataProvider,
  ) {}

  /**
   * Starts the watcher if it's not already running.
   * Initializes monitors, subscribes to finalized blocks, and begins block processing.
   *
   * @param startBlock Optional starting block number
   */
  async start(startBlock?: number): Promise<void> {
    if (this.isRunning) {
      this.logger.debug(`ChainWatcher has already been started.`);
      return;
    }

    await this.initializeMonitors();
    this.isRunning = true;

    const header = await this.api.rpc.chain.getHeader();
    this.latestBlockNumber = header.number.toNumber();

    this.api.rpc.chain.subscribeFinalizedHeads(async header => {
      const blockNumber = header.number.toNumber();
      this.latestBlockNumber = blockNumber;
      await this.store.set('last_on_chain_block', blockNumber);
    });

    this.startBlockProcessingLoop(startBlock);
  }

  /**
   * Stops the watcher if it's running.
   * Sets running state to false and disconnects from the API.
   */
  async stop(): Promise<void> {
    this.isRunning = false;
  }

  /**
   * Initializes monitors based on the latest configuration.
   * For each monitor type:
   * 1. Fetches the latest monitoring groups from the client
   * 2. Filters relevant monitoring groups
   * 3. Creates monitor instance if there are matching groups
   *
   * @param throwError Whether to throw an error if fetching monitoring groups fails
   */
  async initializeMonitors(throwError: boolean = true): Promise<void> {
    let groups: MonitoringGroup[];
    try {
      groups = await this.monitoringConfigClient.getMonitoringGroups();
    } catch (error) {
      this.logger.error(`Failed to fetch monitoring groups: ${error.message}`);
      if (throwError) {
        throw new Error(`Failed to fetch monitoring groups: ${error.message}`);
      }
      return;
    }

    this.monitors = [];
    this.monitors = ChainWatcher.monitorConfigs.flatMap(([monitorType, MonitorClass]) => {
      const filteredGroups = groups.filter(
        group => group.chain === this.chainProps.chain && group.monitors.some(monitor => monitor.name === monitorType),
      );

      if (filteredGroups.length > 0) {
        return [
          new MonitorClass(
            this.logger,
            filteredGroups,
            this.incidents,
            this.chainProps,
            this.chainProvider,
            monitorType,
          ),
        ];
      }
      return [];
    });

    this.logger.debug(`Initialized ${this.monitors.length} monitors for chain ${this.chainProps.chain}`);
    if (this.monitors.length === 0) {
      this.logger.warn(`No monitors were initialized for chain ${this.chainProps.chain}`);
    }
  }

  /**
   * Processes blocks sequentially, ensuring order and continuity.
   *
   * This method:
   * 1. Starts from the provided block number or the last processed block + 1
   * 2. Processes each block by:
   *    - Executing state handlers for all monitors
   *    - Distributing events to relevant monitors
   *    - Processing extrinsic calls and their nested calls
   * 3. Periodically refreshes monitor configurations based on configRefreshIntervalMs
   *    - This ensures monitors stay up-to-date with the latest monitoring groups
   *    - Default refresh interval is 15 minutes
   * 4. Persists the last processed block number for continuity across restarts
   *
   * @param startBlock Optional starting block number
   */
  private async startBlockProcessingLoop(startBlock?: number): Promise<void> {
    const lastProcessedBlock = await this.lastBlockClient.getLastBlock(this.chainProps.chain);
    // Priority: startBlock from config YAML > API service lastProcessedBlock > latest chain block
    let nextBlockToProcess = startBlock ?? lastProcessedBlock ?? this.latestBlockNumber;
    let lastConfigRefreshTime = Date.now();

    while (this.isRunning) {
      // At the moment we use store only for metrics
      await this.store.set('last_processed_block', nextBlockToProcess - 1);

      const now = Date.now();

      // Periodic tasks: refresh config and checkpoint last processed block
      if (now - lastConfigRefreshTime >= this.configRefreshIntervalMs) {
        await this.initializeMonitors(false);
        if (nextBlockToProcess > 0) {
          this.logger.debug(`Setting the last block to: ${nextBlockToProcess - 1}`);
          await this.lastBlockClient.setLastBlock(this.chainProps.chain, nextBlockToProcess - 1);
        }
        lastConfigRefreshTime = now;
      }

      if (this.monitors.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      if (nextBlockToProcess <= this.latestBlockNumber) {
        await this.processBlock(nextBlockToProcess);
        nextBlockToProcess++;
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Processes a single block by:
   * 1. Executing state handlers for all monitors
   * 2. Distributing events to relevant monitors
   * 3. Processing extrinsic calls and their nested calls
   * 4. Persisting the processed block number
   *
   * @param blockNumber The block number to process
   */
  async processBlock(blockNumber: number): Promise<void> {
    this.logger.log(`Processing block: #${blockNumber}`);
    const blockHash = await this.api.rpc.chain.getBlockHash(blockNumber);
    const block = await this.api.rpc.chain.getBlock(blockHash);
    const apiAt = await this.api.at(blockHash);

    // Apply every block handlers: process custom logic, usually storage calls
    await Promise.all(this.monitors.map(m => m.processState({ blockNumber })));

    // Apply event handlers: process event payload
    const records = (await apiAt.query.system.events()) as unknown as EventRecord[];
    for (const eventRecord of records) {
      await Promise.all(this.monitors.map(m => m.processEvent({ blockNumber, eventRecord })));
    }

    // Apply call handlers: process call signature
    for (let extrinsicIndex = 0; extrinsicIndex < block.block.extrinsics.length; extrinsicIndex++) {
      const extrinsic = block.block.extrinsics[extrinsicIndex];
      const origin = extrinsic.signer.toString();
      await this.traverseCallTree(blockNumber, extrinsic.method, origin, extrinsicIndex);
    }
  }

  /**
   * Recursively processes a call and its nested calls.
   * Distributes each call to all monitors for processing.
   *
   * @param blockNumber The block number containing the call
   * @param call The call to process
   * @param origin The origin address of the call
   * @param extrinsicIndex The index of the extrinsic in the block
   */
  private async traverseCallTree(
    blockNumber: number,
    call: CallBase<AnyTuple>,
    origin: string,
    extrinsicIndex: number,
  ): Promise<void> {
    if (!call.meta?.args) return;

    const { section, method } = call;
    const metaArgs = call.meta.args;
    // Find the index of a param by name
    const idxOf = (name: string) => metaArgs.findIndex(a => a.name.toString() === name);

    // 1. Proxy pallet: unwrap call & override origin
    if (section === 'proxy' && method === 'proxy') {
      const real = call.args[idxOf('real')].toString();
      const inner = call.args[idxOf('call')] as unknown as CallBase<AnyTuple>;
      return this.traverseCallTree(blockNumber, inner, real, extrinsicIndex);
    }

    // 2. Generic Vec<RuntimeCall>: batch-style wrappers (e.g. utility.batch, etc.)
    const callsIdx = idxOf('calls');
    if (callsIdx >= 0) {
      const innerCalls = call.args[callsIdx] as unknown as CallBase<AnyTuple>[];
      for (const c of innerCalls) {
        await this.traverseCallTree(blockNumber, c, origin, extrinsicIndex);
      }
      return;
    }

    // 3. Generic Box<RuntimeCall>: single-call wrappers (e.g. multisig.asMulti, sudo, scheduler.execute, etc.)
    const callIdx = idxOf('call');
    if (callIdx >= 0) {
      const inner = call.args[callIdx] as unknown as CallBase<AnyTuple>;
      return this.traverseCallTree(blockNumber, inner, origin, extrinsicIndex);
    }

    // 4. Base: dispatch to all monitors
    await Promise.all(this.monitors.map(m => m.processCall({ blockNumber, call, origin, extrinsicIndex })));
  }
}
