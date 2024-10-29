import { ApiPromise } from '@polkadot/api';
import { Logger, MonitoringGroup } from '../../interfaces';
import { BlockHandler } from '../decorators';
import { MonitorType } from '../../constants';
import { IncidentHandler } from '../../incident/incident-handler';
import { ChainWatcherStore } from '../../store/chain-watcher-store';
import { AbstractBalanceMonitor } from './abstract-balance-monitor';

abstract class BalanceMonitor extends AbstractBalanceMonitor {
  constructor(
    logger: Logger,
    api: ApiPromise,
    groups: MonitoringGroup[],
    incidentHandler: IncidentHandler,
    store: ChainWatcherStore,
    protected monitorType: MonitorType,
  ) {
    super(logger, api, groups, incidentHandler, store);
  }

  @BlockHandler()
  async handleBalanceChange({ blockHash, blockNumber }): Promise<void> {
    const currentBalances = await this.getBalances(blockNumber);
    const previousBalances = await this.getBalances(blockNumber - 1);
    for (const [account, currentBalance] of Object.entries(currentBalances)) {
      const previousBalance = previousBalances[account];

      const isFiring = this.monitorType === MonitorType.BalanceIncrement
          ? currentBalance > previousBalance
          : currentBalance < previousBalance;

      const matches = this.getGroups(account);
      for (const { account: account, group } of matches) {
        const changeType = this.monitorType === MonitorType.BalanceIncrement
            ? 'increased'
            : 'decreased';
        const message =
          `Balance ${changeType} for account "${account.name}". ` +
          `Previous balance: ${previousBalance.toString()}, ` +
          `New balance: ${currentBalance.toString()}`;

        const key = `${account}:${group.name}:handleBalanceChange`;
        await this.incidents.ongoingIncident(message, group.alerts, blockNumber, key, isFiring);

        this.logger.debug(`Balance change detected for account "${account.name}"`);
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
