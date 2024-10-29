import { BalanceSettings } from '../../interfaces';
import { BlockHandler } from '../decorators';
import { MonitorType } from '../../constants';
import { AbstractBalanceMonitor } from './abstract-balance-monitor';

export class BalanceThresholdMonitor extends AbstractBalanceMonitor {

  @BlockHandler()
  async handleBalanceThreshold({ blockHash, blockNumber }): Promise<void> {
    const currentBalances = await this.getBalances(blockNumber);

    for (const [acc, currentBalance] of Object.entries(currentBalances)) {
      for (const { account, group } of this.getGroups(acc)) {
        const settings: BalanceSettings = account[MonitorType.BalanceThreshold];

        if (settings && settings.balanceThreshold !== undefined) {
          const isFiring = currentBalance < settings.balanceThreshold;
          const message =
            `Balance for account "${account.name}" is below threshold. ` +
            `Current balance: ${currentBalance}, Threshold: ${settings.balanceThreshold}`;

          const key = `${account}:${group.name}:handleBalanceThreshold`;
          await this.incidents.ongoingIncident(message, group.alerts, blockNumber, key, isFiring);
        }
      }
    }
  }
}
