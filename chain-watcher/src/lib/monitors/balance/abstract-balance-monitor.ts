import { MonitoringGroup, AccountSettings } from '../../interfaces';
import { AbstractMonitor } from '../abstract-monitor';
import { AccountInfo } from '@polkadot/types/interfaces';

export abstract class AbstractBalanceMonitor extends AbstractMonitor {
  protected accountGroups: Map<string, { account: AccountSettings; group: MonitoringGroup }[]> = new Map();

  protected async getBalances(blockNumber: number): Promise<Map<string, bigint>> {
    let balances: Map<string, bigint> | null = await this.store.getAccountBalances(blockNumber);
    if (!balances) {
      const accountInfos = await this.api.query.system.account.multi<AccountInfo>(this.accounts);
      balances = new Map(
        this.accounts.map((account, index) => [
          account, accountInfos[index].data.free.toBigInt()
        ]),
      );
      await this.store.setAccountBalances(blockNumber, balances);
    }
    return balances;
  }
}
