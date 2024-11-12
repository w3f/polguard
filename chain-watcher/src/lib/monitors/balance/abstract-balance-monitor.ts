import { MonitorType } from '../../constants';
import { AbstractMonitor } from '../abstract-monitor';
import { AccountInfo } from '@polkadot/types/interfaces';

export abstract class AbstractBalanceMonitor<T extends MonitorType> extends AbstractMonitor<T> {
  protected async getBalances(blockNumber: number): Promise<Map<string, bigint>> {
    let balances = await this.store.getAccountBalances(blockNumber);
    if (!balances) {
      const accountInfos = await this.api.query.system.account.multi<AccountInfo>(this.uniqueAddresses);
      balances = new Map(
        this.uniqueAddresses.map((address, index) => [address, accountInfos[index].data.free.toBigInt()]),
      );
      await this.store.setAccountBalances(blockNumber, balances);
    }
    return balances;
  }
}
