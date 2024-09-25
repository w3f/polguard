import { ApiPromise } from '@polkadot/api';
import { BlockHash } from '@polkadot/types/interfaces';
import { AbstractMonitor } from '../abstract-monitor';
import { MonitoringGroup, EventDispatcher } from '../../interfaces';
import { BlockHandler } from '../decorators';
import { MonitorType } from '@core/constants';

abstract class BalanceMonitor extends AbstractMonitor {
  constructor(
    api: ApiPromise,
    groups: MonitoringGroup[],
    eventDispatcher: EventDispatcher,
    protected monitorType: MonitorType
  ) {
    super(api, groups, eventDispatcher);
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
  
      if (balanceChanged) {
        const accountGroups = this.getGroups(account);
        for (const { account: accountSettings, group } of accountGroups) {
          const changeType = this.monitorType === MonitorType.BalanceIncrement ? 'increased' : 'decreased';
          
          await this.eventDispatcher.emitIncident({
            message: `Balance ${changeType} for account "${accountSettings.name}". ` +
                     `Previous balance: ${previousBalance.toString()}, ` +
                     `New balance: ${currentBalance.toString()}`,
            alerts: group.alerts,
          });
        }
      }
    }
  }

}

export class BalanceIncrementMonitor extends BalanceMonitor {
  constructor(api: ApiPromise, groups: MonitoringGroup[], eventDispatcher: EventDispatcher) {
    super(api, groups, eventDispatcher, MonitorType.BalanceIncrement);
  }
}

export class BalanceDecrementMonitor extends BalanceMonitor {
  constructor(api: ApiPromise, groups: MonitoringGroup[], eventDispatcher: EventDispatcher) {
    super(api, groups, eventDispatcher, MonitorType.BalanceDecrement);
  }
}
