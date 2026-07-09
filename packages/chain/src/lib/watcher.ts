import type { Subscription } from 'rxjs';

import {
  AppLogger,
  ChainProperties,
  MonitorType,
  IncidentHandlerClient,
  Store,
  MonitorConstructor,
  ChainDataProvider,
  Monitor,
  ChainTelemetryClient,
  MonitoringConfigClient,
  BlockClient,
  RuntimeClient,
  DecodedCall,
} from '../types';
import {
  IdentityMonitor,
  BalancesMonitor,
  GovernanceMonitor,
  StakingMonitor,
  XcmMonitor,
  AssetsMonitor,
} from './monitors';
import { decodeExtrinsic } from './extrinsic-decoder';
import { encodeAddress, resolveMultiAddress } from './utils';

/**
 * ChainWatcher is responsible for monitoring blockchain activities and coordinating monitors.
 * It processes blocks sequentially and distributes events, calls, and block data to appropriate monitors.
 */
export class ChainWatcher {
  monitors: Monitor[] = [];
  private isRunning = false;
  private latestBlockNumber = 0;
  private latestProcessedBlock?: number;
  private finalizedSub?: Subscription;

  private static readonly monitorConfigs = [
    [MonitorType.Governance, GovernanceMonitor],
    [MonitorType.Staking, StakingMonitor],
    [MonitorType.Balances, BalancesMonitor],
    [MonitorType.Identity, IdentityMonitor],
    [MonitorType.Xcm, XcmMonitor],
    [MonitorType.Assets, AssetsMonitor],
  ] as [MonitorType, MonitorConstructor<MonitorType>][];

  constructor(
    private logger: AppLogger,
    private configClient: MonitoringConfigClient,
    private store: Store,
    private blockClient: BlockClient,
    private runtimeClient: RuntimeClient,
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
      this.logger.debug('ChainWatcher has already been started.');
      return;
    }

    await this.initializeMonitors();
    this.isRunning = true;

    const finalized = await this.blockClient.getFinalizedBlock();
    this.latestBlockNumber = finalized.number;
    this.telemetry?.recordLatestBlock(finalized.number);

    this.finalizedSub = this.blockClient.finalizedBlock$.subscribe(block => {
      this.latestBlockNumber = block.number;
      this.telemetry?.recordLatestBlock(block.number);
    });

    this.startBlockProcessingLoop(startBlock).catch(err =>
      this.logger.error(`Block processing loop exited: ${(err as Error).message}`),
    );
  }

  /**
   * Stops the watcher if it's running.
   * Unsubscribes from finalized block updates.
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    this.finalizedSub?.unsubscribe();
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
    this.logger.info(`Processing block: #${blockNumber}`);

    const blockHash = await this.blockClient._request<string, [number]>('chain_getBlockHash', [blockNumber]);

    // Apply state handlers: process custom logic, usually storage calls
    await Promise.all(this.monitors.map(m => m.processState({ blockContext: { blockNumber } })));

    // Apply event handlers: process event payload
    const systemEvents = await this.runtimeClient.query.System.Events.getValue({ at: blockHash });
    for (let eventIdx = 0; eventIdx < systemEvents.length; eventIdx++) {
      const systemEvent = systemEvents[eventIdx];
      await Promise.all(this.monitors.map(m => m.processEvent(systemEvent, { blockNumber, eventIdx })));
    }

    // Apply call handlers: decode extrinsics and process call tree
    const body = await this.blockClient.getBlockBody(blockHash);
    for (let extrinsicIdx = 0; extrinsicIdx < body.length; extrinsicIdx++) {
      try {
        const decoded = decodeExtrinsic(body[extrinsicIdx], this.chainProps.extrinsicExtraOffset);
        if (!decoded.isSigned || !decoded.signer) continue;

        const tx = await this.runtimeClient.txFromCallData(decoded.callData);
        const origin = encodeAddress(decoded.signer, this.chainProps.ss58Format);
        const callSeq = { value: 0 };
        await this.traverseCallTree(blockNumber, tx.decodedCall, origin, extrinsicIdx, callSeq);
      } catch (error) {
        this.logger.warn(`Failed to process extrinsic ${blockNumber}-${extrinsicIdx}: ${(error as Error).message}`);
      }
    }

    await this.store.setLastBlock(this.chainProps.chain, blockNumber);
  }

  /**
   * Recursively processes a PAPI decoded call and its nested calls.
   * Distributes each leaf call to all monitors for processing.
   *
   * Handles:
   * - Proxy.proxy: unwraps inner call and overrides origin with the proxied account
   * - Utility.batch/batch_all/force_batch: iterates over inner calls
   * - Sudo.sudo, Multisig.as_multi, etc.: unwraps single inner call
   *
   * @param blockNumber The block number containing the call
   * @param call The PAPI decoded call structure
   * @param origin The SS58 origin address of the call
   * @param extrinsicIdx The index of the extrinsic in the block
   * @param callSeq Mutable counter used to assign sequential callIdx values
   */
  private async traverseCallTree(
    blockNumber: number,
    call: DecodedCall,
    origin: string,
    extrinsicIdx: number,
    callSeq: { value: number },
  ): Promise<void> {
    const pallet = call.type;
    const method = call.value.type;
    const args = call.value.value;
    const callKey = `${pallet}.${method}`;
    // 1. Proxy.proxy: unwrap inner call and override origin with the real account
    if (callKey === 'Proxy.proxy') {
      const real = resolveMultiAddress(args.real);
      const inner = args.call as DecodedCall;
      return this.traverseCallTree(blockNumber, inner, real, extrinsicIdx, callSeq);
    }
    // 2. Batch-style wrappers: iterate over Vec<RuntimeCall>
    const BATCH_CALLS = new Set(['Utility.batch', 'Utility.batch_all', 'Utility.force_batch']);
    if (BATCH_CALLS.has(callKey) && Array.isArray(args.calls)) {
      for (const inner of args.calls) {
        await this.traverseCallTree(blockNumber, inner as DecodedCall, origin, extrinsicIdx, callSeq);
      }
      return;
    }
    // 3. Single-call wrappers: unwrap Box<RuntimeCall>
    const SINGLE_WRAPPERS = new Set([
      'Sudo.sudo',
      'Sudo.sudo_unchecked_weight',
      'Multisig.as_multi',
      'Multisig.as_multi_threshold_1',
    ]);
    if (SINGLE_WRAPPERS.has(callKey) && args.call) {
      return this.traverseCallTree(blockNumber, args.call as DecodedCall, origin, extrinsicIdx, callSeq);
    }
    // 4. Leaf call: assign callIdx and dispatch to monitors
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
