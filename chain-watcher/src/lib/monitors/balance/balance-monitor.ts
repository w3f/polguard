import { ApiPromise } from '@polkadot/api';
import { BlockHash } from '@polkadot/types/interfaces';
import { AbstractMonitor } from '../abstract-monitor';
import { Logger, MonitoringGroup } from '../../interfaces';
import { BlockHandler } from '../decorators';
import { MonitorType } from '../../constants';
import { IncidentHandler } from '../../incident/incident-handler';
import { ChainWatcherStore } from '../../store/chain-watcher-store';

abstract class BalanceMonitor extends AbstractMonitor {
  constructor(
    logger: Logger,
    api: ApiPromise,
    groups: MonitoringGroup[],
    incidentHandler: IncidentHandler,
    store: ChainWatcherStore,
    protected monitorType: MonitorType
  ) {
    super(logger, api, groups, incidentHandler, store);
  }

  @BlockHandler()
  async handleBalanceChange(_blockHash: BlockHash, blockNumber: number): Promise<void> {
    const currentBalances = await this.getBalances(blockNumber);
    const previousBalances = await this.getBalances(blockNumber - 1);
    for (const [account, currentBalance] of Object.entries(currentBalances)) {
      const previousBalance = previousBalances[account];
      
      const balanceChanged = this.monitorType === MonitorType.BalanceIncrement
        ? currentBalance > previousBalance
        : currentBalance < previousBalance;
  
      const accountGroups = this.getGroups(account);
      for (const { account: accountSettings, group } of accountGroups) {
        const changeType = this.monitorType === MonitorType.BalanceIncrement ? 'increased' : 'decreased';
        const message = `Balance ${changeType} for account "${accountSettings.name}". ` +
                        `Previous balance: ${previousBalance.toString()}, ` +
                        `New balance: ${currentBalance.toString()}`
        const incidentKey = `${account}:${group.name}:handleBalanceChange`;
        this.logger.debug(`Balance change detected for account "${accountSettings.name}"`)
        await this.incidentHandler.handleOngoingIncident(
          incidentKey,
          balanceChanged,
          message,
          group.alerts,
          blockNumber
        );
      }
      
    }
  }

}

export class BalanceIncrementMonitor extends BalanceMonitor {
  constructor(logger: Logger, api: ApiPromise, groups: MonitoringGroup[], incidentHandler: IncidentHandler, store: ChainWatcherStore) {
    super(logger, api, groups, incidentHandler, store, MonitorType.BalanceIncrement);
  }
}

export class BalanceDecrementMonitor extends BalanceMonitor {
  constructor(logger: Logger, api: ApiPromise, groups: MonitoringGroup[], incidentHandler: IncidentHandler, store: ChainWatcherStore) {
    super(logger, api, groups, incidentHandler, store, MonitorType.BalanceDecrement);
  }
}
