import { EveryBlockHandlerParams } from '../../interfaces';
import { EveryBlockHandler } from '../../decorators';
import { MonitorType } from '../../constants';
import { AbstractMonitor } from '../abstract-monitor';

export class BalanceThresholdMonitor extends AbstractMonitor<MonitorType.BalanceThreshold> {
  @EveryBlockHandler()
  async handleBalanceThreshold({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const currentBalances = await this.stateQuery.balances(this.uniqueAddresses, blockNumber);

    for (const address in currentBalances) {
      const currentBalance = currentBalances[address];
      for (const { account, alerts, groupId } of this.getAccounts(address)) {
        if (account.settings.balanceThreshold !== undefined) {
          const isFiring = currentBalance < account.settings.balanceThreshold;

          const message = this.createMessage([
            `Balance for account "${account.name}" is below threshold.`,
            `Current balance: ${this.formatBalance(currentBalance)}`,
            `Threshold: ${this.formatBalance(account.settings.balanceThreshold)}`,
            `Details: ${this.getAccountLink(account.ss58)}`,
          ]);

          const key = `${account.ss58}:${groupId}:handleBalanceThreshold`;
          await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
        }
      }
    }
  }
}
