import { ApiPromise } from '@polkadot/api';
import type { EventRecord } from '@polkadot/types/interfaces/system';

import { EventDispatcher, Logger, Monitor, MonitoringGroup } from '../interfaces';
import { Chain, MonitorType } from '../constants';
import { GovernanceMonitor } from '../monitors/governance/governance-monitor';
import { TransactionEgressMonitor, TransactionIngressMonitor } from '../monitors/transaction/transaction-monitor';
import { ValidatorMonitor } from '../monitors/validator/validator-monitor';
import { BalanceDecrementMonitor, BalanceIncrementMonitor } from '../monitors/balance/balance-monitor';
import { BalanceThresholdMonitor } from '../monitors/balance/balance-threshold-monitor';

export abstract class AbstractChainWatcher {
  protected log: Logger;
  private latestBlockNumber: number = 0;
  private isRunning: boolean = false;
  protected monitors: Monitor[] = [];

  constructor(
    protected logger: Logger,
    protected chain: Chain,
    protected monitoringGroups: MonitoringGroup[],
    protected eventDispatcher: EventDispatcher,
    protected api: ApiPromise
  ) {
    this.initializeMonitors();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.log.debug('ChainWatcher has already been started.');
      return;
    }

    // Initialize the latest block number
    const header = await this.api.rpc.chain.getHeader();
    this.latestBlockNumber = header.number.toNumber();

    this.api.rpc.chain.subscribeFinalizedHeads((header) => {
      const blockNumber = header.number.toNumber();
      this.latestBlockNumber = blockNumber;
    });

    this.isRunning = true;
    this.runBlockProcessing();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.api.disconnect();
  }

  protected initializeMonitors(): void {
    const monitorClasses = [
      { monitorType: MonitorType.Governance, class: GovernanceMonitor },
      { monitorType: MonitorType.Validator, class: ValidatorMonitor },
      { monitorType: MonitorType.TransactionIngress, class: TransactionIngressMonitor },
      { monitorType: MonitorType.TransactionEgress, class: TransactionEgressMonitor },
      { monitorType: MonitorType.BalanceDecrement, class: BalanceDecrementMonitor },
      { monitorType: MonitorType.BalanceIncrement, class: BalanceIncrementMonitor },
      { monitorType: MonitorType.BalanceThreshold, class: BalanceThresholdMonitor }
    ];
  
    this.monitors = monitorClasses.flatMap(({ monitorType, class: MonitorClass }) => {
      const monitoringGroups = this.monitoringGroups.filter((group) =>
        group.monitors.some((monitor) => monitor.name === monitorType)
      );

      return [new MonitorClass(this.api, monitoringGroups, this.eventDispatcher)];
    });
  }

  protected async processBlock(blockNumber: number): Promise<void> {
    this.log.debug(`Processing block: #${blockNumber}`);
    const blockHash = await this.api.rpc.chain.getBlockHash(blockNumber);
    const apiAt = await this.api.at(blockHash);

    for (const monitor of this.monitors) {
      await monitor.processBlock(blockHash, blockNumber);
    }
    await apiAt.query.system.events(async (records: EventRecord[]) => {
      for (const eventRecord of records) {
        for (const monitor of this.monitors) {
          await monitor.processEvent(blockHash, eventRecord);
        }
      }
    })
    await this.setLastProcessedBlock(blockNumber);
  }

  private async runBlockProcessing(): Promise<void> {
    let nextBlockToProcess = await this.getLastProcessedBlock() + 1;
  
    while (this.isRunning) {
      if (nextBlockToProcess <= this.latestBlockNumber) {
        await this.processBlock(nextBlockToProcess);
        nextBlockToProcess++;
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  protected abstract getLastProcessedBlock(): Promise<number>;
  protected abstract setLastProcessedBlock(block: number): Promise<void>;
}
