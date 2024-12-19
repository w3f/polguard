import { EveryBlockHandlerParams, MonitorType } from '@w3f/monitoring-types';
import { EveryBlockHandler } from '../../decorators';
import { AbstractMonitor } from '../abstract-monitor';

abstract class BalanceMonitor<
  T extends MonitorType.BalanceIncrement | MonitorType.BalanceDecrement,
> extends AbstractMonitor<T> {
  protected abstract isBalanceChangeFiring(currentBalance: bigint, previousBalance: bigint): boolean;
  protected abstract getChangeDescription(): string;

  @EveryBlockHandler()
  async handleBalanceChange({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const currentBalances = await this.stateQuery.balances(this.uniqueAddresses, blockNumber);
    const previousBalances = await this.stateQuery.balances(this.uniqueAddresses, blockNumber - 1);

    for (const address in currentBalances) {
      const currentBalance = currentBalances[address];
      const previousBalance = previousBalances[address];
      if (previousBalance === undefined) continue;

      const isFiring = this.isBalanceChangeFiring(currentBalance, previousBalance);
      const matches = this.getAccounts(address);
      for (const { account, alerts, groupId } of matches) {
        const message = this.createMessage([
          `Balance ${this.getChangeDescription()} for account ${account.name}.`,
          `Previous balance: ${this.formatBalance(previousBalance)}`,
          `Actual balance: ${this.formatBalance(currentBalance)}`,
          `Details: ${this.getAccountLink(account.ss58)}`,
        ]);
        const key = `${account.ss58}:${groupId}:handleBalanceChange`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);

        this.logger.debug(`Balance change detected for account "${account.name}"`);
      }
    }
  }
}

export class BalanceIncrementMonitor extends BalanceMonitor<MonitorType.BalanceIncrement> {
  protected isBalanceChangeFiring(currentBalance: bigint, previousBalance: bigint): boolean {
    return currentBalance > previousBalance;
  }

  protected getChangeDescription(): string {
    return 'increased';
  }
}

export class BalanceDecrementMonitor extends BalanceMonitor<MonitorType.BalanceDecrement> {
  protected isBalanceChangeFiring(currentBalance: bigint, previousBalance: bigint): boolean {
    return currentBalance < previousBalance;
  }

  protected getChangeDescription(): string {
    return 'decreased';
  }
}
