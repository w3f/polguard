import { BlockHash } from '@polkadot/types/interfaces';
import { AbstractMonitor } from '../abstract-monitor';
import { BalanceSettings } from '../../interfaces';
import { BlockHandler } from '../decorators';
import { MonitorType } from '../../constants';

export class BalanceThresholdMonitor extends AbstractMonitor {
  @BlockHandler()
  async handleBalanceThreshold(_blockHash: BlockHash, blockNumber: number): Promise<void> {
    const currentBalances = await this.getBalances(blockNumber);

    for (const [account, currentBalance] of Object.entries(currentBalances)) {
      const accountGroups = this.getGroups(account);
      for (const { account: accountSettings, group } of accountGroups) {
        const settings = accountSettings[MonitorType.BalanceThreshold] as BalanceSettings;
        
        if (settings && settings.balanceThreshold !== undefined) {
          const isFiring = currentBalance < settings.balanceThreshold;
          const message = `Balance for account "${accountSettings.name}" is below threshold. ` +
                          `Current balance: ${currentBalance}, Threshold: ${settings.balanceThreshold}`;
          
          const incidentKey = `${account}:${group.name}:handleBalanceThreshold`;
          await this.incidentHandler.handleActiveIncident(
            incidentKey,
            isFiring,
            message,
            group.alerts,
            blockNumber
          );
        }
      }
    }
  }
}