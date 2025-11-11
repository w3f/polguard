import { CallBase } from '@polkadot/types/types/calls';
import { AnyTuple } from '@polkadot/types/types';
import { EventRecord } from '@polkadot/types/interfaces';

import {
  Logger,
  IncidentHandlerClient,
  Store,
  ChainProperties,
  MonitorType,
  MonitorConstructor,
  ChainDataProvider,
  Monitor,
  ChainApiClient,
  ChainTelemetryClient,
  MonitoringConfigClient,
} from '@w3f/monitoring-common';
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
 */
export class ChainWatcher {
  monitors: Monitor[] = [];
  private isRunning = false;
  private latestBlockNumber = 0;
  private latestProcessedBlock?: number;

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
    private configClient: MonitoringConfigClient,
    private store: Store,
    private api: ChainApiClient,
    private incidents: IncidentHandlerClient,
    private chainProps: ChainProperties,
    private chainProvider: ChainDataProvider,
    private telemetry?: ChainTelemetryClient,
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
    const blockNumber = header.number.toNumber();
    this.latestBlockNumber = blockNumber;
    this.telemetry?.recordLatestBlock(blockNumber);

    this.api.rpc.chain.subscribeFinalizedHeads(async header => {
      const blockNumber = header.number.toNumber();
      this.latestBlockNumber = blockNumber;
      this.telemetry?.recordLatestBlock(blockNumber);
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
   * Used to flush the watermark on shutdown.
   */
  getLastProcessedBlock(): number | undefined {
    return this.latestProcessedBlock;
  }

  /**
   * Initializes monitors based on the latest configuration.
   */
  async initializeMonitors(): Promise<void> {
    const groups = await this.configClient.getMonitoringGroups();

    this.telemetry?.recordMonitoringConfig(groups);

    this.monitors = ChainWatcher.monitorConfigs.flatMap(([monitorType, MonitorClass]) => {
      const filteredGroups = groups.filter(group => group.monitors.some(monitor => monitor.name === monitorType));

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

    if (this.monitors.length === 0) {
      this.logger.warn(`No monitors configured for chain ${this.chainProps.chain}`);
    }
  }

  /**
   * Processes blocks sequentially, ensuring order and continuity.
   *
   * @param startBlock Optional starting block number
   */
  private async startBlockProcessingLoop(startBlock?: number): Promise<void> {
    const lastProcessedBlock = await this.store.getLastBlock(this.chainProps.chain);
    // Priority: startBlock from config YAML > Store lastProcessedBlock > latest chain block
    let nextBlockNumber = startBlock ?? lastProcessedBlock ?? this.latestBlockNumber;

    while (this.isRunning) {
      // Check for config changes every block
      await this.initializeMonitors();

      if (this.monitors.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      if (nextBlockNumber <= this.latestBlockNumber) {
        this.telemetry?.recordCurrentBlock(nextBlockNumber);
        const start = performance.now();
        await this.processBlock(nextBlockNumber);
        const end = performance.now();
        this.telemetry?.recordProcessingTime(end - start);
        this.latestProcessedBlock = nextBlockNumber;
        this.telemetry?.recordProcessedBlock(nextBlockNumber);
        nextBlockNumber++;
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

    this.chainProvider.initializeBlock(blockNumber, apiAt);

    // Apply state handlers: process custom logic, usually storage calls
    await Promise.all(this.monitors.map(m => m.processState({ blockContext: { blockNumber } })));

    // Apply event handlers: process event payload
    const records = (await apiAt.query.system.events()) as unknown as EventRecord[];
    for (let eventIdx = 0; eventIdx < records.length; eventIdx++) {
      const eventRecord = records[eventIdx];
      await Promise.all(
        this.monitors.map(m => m.processEvent({ blockContext: { blockNumber, eventIdx }, eventRecord })),
      );
    }

    // Apply call handlers: process call signature
    for (let extrinsicIdx = 0; extrinsicIdx < block.block.extrinsics.length; extrinsicIdx++) {
      const extrinsic = block.block.extrinsics[extrinsicIdx];
      const origin = extrinsic.signer.toString();
      const callSeq = { value: 0 };
      await this.traverseCallTree(blockNumber, extrinsic.method, origin, extrinsicIdx, callSeq);
    }
  }

  /**
   * Recursively processes a call and its nested calls.
   * Distributes each call to all monitors for processing.
   *
   * @param blockNumber The block number containing the call
   * @param call The call to process
   * @param origin The origin address of the call
   * @param extrinsicIdx The index of the extrinsic in the block
   * @param callSeq Mutable counter used to assign sequential callIdx values
   */
  private async traverseCallTree(
    blockNumber: number,
    call: CallBase<AnyTuple>,
    origin: string,
    extrinsicIdx: number,
    callSeq: { value: number },
  ): Promise<void> {
    const metaArgs = call.meta?.args;
    if (!metaArgs) return;

    const { section, method } = call;
    // Find the index of a param by name
    const idxOf = (name: string) => metaArgs.findIndex(a => a.name.toString() === name);

    const argIdxCall = idxOf('call');
    const argIdxCalls = idxOf('calls');

    // 1. Proxy pallet: unwrap call & override origin
    if (section === 'proxy' && method === 'proxy') {
      const realIdx = idxOf('real');
      const real = call.args[realIdx].toString();
      const inner = call.args[argIdxCall] as unknown as CallBase<AnyTuple>;
      return this.traverseCallTree(blockNumber, inner, real, extrinsicIdx, callSeq);
    }

    // 2. Generic Vec<RuntimeCall>: batch-style wrappers (e.g. utility.batch, etc.)
    if (argIdxCalls >= 0) {
      const innerCalls = call.args[argIdxCalls] as unknown as CallBase<AnyTuple>[];
      for (const c of innerCalls) {
        await this.traverseCallTree(blockNumber, c, origin, extrinsicIdx, callSeq);
      }
      return;
    }

    // 3. Generic Box<RuntimeCall>: single-call wrappers (e.g. multisig.asMulti, sudo, scheduler.execute, etc.)
    if (argIdxCall >= 0) {
      const inner = call.args[argIdxCall] as unknown as CallBase<AnyTuple>;
      return this.traverseCallTree(blockNumber, inner, origin, extrinsicIdx, callSeq);
    }

    // 4. Base leaf: assign callIdx and dispatch
    const leafCallIdx = callSeq.value++;
    await Promise.all(
      this.monitors.map(m =>
        m.processCall({
          blockContext: { blockNumber, extrinsicIdx, callIdx: leafCallIdx },
          call,
          origin,
        }),
      ),
    );
  }
}
