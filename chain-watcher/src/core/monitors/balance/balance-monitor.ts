import { ApiPromise } from '@polkadot/api';
import { BlockHash } from '@polkadot/types/interfaces';
import { AbstractMonitor } from '../abstract-monitor';
import { Incident, MonitoringGroup, AlertSettings, EventDispatcher, AccountSettings, BalanceSettings } from '../../interfaces';
import { BlockHandler } from '../decorators';
import { AccountInfo } from '@polkadot/types/interfaces';
import { MonitorType } from '@core/constants';

abstract class BalanceMonitor extends AbstractMonitor {
  private previousBalances: Map<string, bigint> = new Map();

  constructor(
    api: ApiPromise,
    groups: MonitoringGroup[],
    eventDispatcher: EventDispatcher,
    protected monitorType: MonitorType
  ) {
    super(api, groups, eventDispatcher);
  }

  @BlockHandler()
  async handleBlock(blockHash: BlockHash, blockNumber: number): Promise<void> {
    const uniqueAccounts = Array.from(new Set(this.groups.flatMap(group => group.accounts)));
    const currentBalances = await this.fetchAccountBalances(uniqueAccounts);
  
    this.checkBalanceChanges(currentBalances);
    this.checkBalanceThresholds(currentBalances);
  
    this.previousBalances = currentBalances;
  }
  

  private async fetchAccountBalances(accounts: AccountSettings[]): Promise<Map<string, bigint>> {
    const addresses = accounts.map(account => account.ss58);
    const balances = await this.api.query.system.account.multi<AccountInfo>(addresses);
  
    return new Map(
      accounts.map((account, index) => [
        account.ss58,
        balances[index].data.free.toBigInt()
      ])
    );
  }
  

  private checkBalanceChanges(currentBalances: Map<string, bigint>): void {
    for (const [address, currentBalance] of currentBalances) {
      const previousBalance = this.previousBalances.get(address) || currentBalance;
      
      const balanceChanged = this.monitorType === MonitorType.BalanceIncrement
        ? currentBalance > previousBalance
        : currentBalance < previousBalance;

      if (balanceChanged) {
        const accountGroups = this.getGroups(address);
        for (const { account, group } of accountGroups) {
          const incident = this.createBalanceChangeIncident(account, previousBalance, currentBalance, group.alerts);
          this.emitIncident(incident);
        }
      }
    }
  }

  private checkBalanceThresholds(currentBalances: Map<string, bigint>): void {
    for (const [address, balance] of currentBalances) {
      const accountGroups = this.getGroups(address);
      for (const { account, group } of accountGroups) {
        const settings = account[this.monitorType] as BalanceSettings;
        if (settings.balanceThreshold !== undefined && balance < settings.balanceThreshold) {
          const incident = this.createBalanceBelowThresholdIncident(account, balance, group.alerts);
          this.emitIncident(incident);
        }
      }
    }
  }

  private createBalanceChangeIncident(
    account: AccountSettings,
    previousBalance: bigint,
    newBalance: bigint,
    alerts: AlertSettings
  ): Incident {
    const changeType = this.monitorType === MonitorType.BalanceIncrement ? 'increased' : 'decreased';
    return {
      message: `Balance ${changeType} for account "${account.name}". ` +
               `Previous balance: ${this.formatBalance(previousBalance)}, ` +
               `New balance: ${this.formatBalance(newBalance)}`,
      alerts: alerts,
    };
  }

  private createBalanceBelowThresholdIncident(
    account: AccountSettings,
    balance: bigint,
    alerts: AlertSettings
  ): Incident {
    return {
      message: `Balance for account "${account.name}" is below threshold. ` +
               `Current balance: ${this.formatBalance(balance)}, `,
      alerts: alerts,
    };
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
