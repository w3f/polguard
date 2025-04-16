import {
  Chain,
  StateHandlerParams,
  MonitorType,
  BalancesHandlerType as H,
  EventHandlerParams,
} from '@w3f/monitoring-types';
import { Event, State } from '../decorators';
import { AbstractMonitor } from './abstract-monitor';

export class BalancesMonitor extends AbstractMonitor<MonitorType.Balances> {
  @State(H.BalanceChange, [Chain.Polkadot, Chain.Kusama])
  async balanceChange({ blockNumber, handler }: StateHandlerParams<H.BalanceChange>): Promise<void> {
    const addresses = this.reg.getUniqueAddresses();
    const currentBalances = await this.chain.systemAccountBalance(addresses, blockNumber);
    const previousBalances = await this.chain.systemAccountBalance(addresses, blockNumber - 1);

    for (const address of addresses) {
      const currentBalance = currentBalances[address];
      const previousBalance = previousBalances[address];

      for (const { account, alerts, groupId } of this.reg.getAccounts(handler, address)) {
        const compareFunc = BalancesMonitor.comparisonFunctions[account.settings.changeComparison];
        const message = this.fmt.message(
          [
            `Balance changed for ${this.fmt.accountLink(account)}`,
            `Previous: ${this.fmt.balance(previousBalance)}`,
            `Current: ${this.fmt.balance(currentBalance)}`,
          ],
          { blockNumber },
        );
        if (compareFunc(currentBalance, previousBalance)) {
          const key = { wallet: account.ss58, groupId, handler };
          await this.incidents.handle(message, alerts, key, blockNumber);
        }
      }
    }
  }

  @State(H.BalanceThreshold, [Chain.Polkadot, Chain.Kusama])
  async balanceThreshold({ blockNumber, handler }: StateHandlerParams<H.BalanceThreshold>): Promise<void> {
    const addresses = this.reg.getUniqueAddresses();
    const currentBalances = await this.chain.systemAccountBalance(addresses, blockNumber);

    for (const address of addresses) {
      const currentBalance = currentBalances[address];
      for (const { account, alerts, groupId } of this.reg.getAccounts(handler, address)) {
        if (!account.settings.threshold) continue;

        const message = this.fmt.message(
          [
            `Balance for ${this.fmt.accountLink(account)} is below threshold.`,
            `Current balance: ${this.fmt.balance(currentBalance)}`,
            `Threshold: ${this.fmt.balance(account.settings.threshold)}`,
          ],
          { blockNumber },
        );
        const key = { wallet: account.ss58, groupId, handler };
        const isFiring = currentBalance < account.settings.threshold;
        await this.incidents.handle(message, alerts, key, blockNumber, isFiring);
      }
    }
  }

  @Event(H.TransferIngress, [Chain.Polkadot, Chain.Kusama], 'balances.Transfer')
  async balancesTransferIngress({
    eventRecord,
    blockNumber,
    handler,
  }: EventHandlerParams<H.TransferIngress>): Promise<void> {
    const [from, to, amount] = eventRecord.event.data.map(item => item.toString());

    for (const { account, alerts, groupId } of this.reg.getAccounts(handler, to)) {
      const message = this.fmt.message(
        [
          `${this.fmt.accountLink(account)} received ${this.fmt.balance(amount)}`,
          `From: ${this.fmt.accountLink({ ss58: from, name: from, hex: '' })}`,
        ],
        { blockNumber, phase: eventRecord.phase },
      );
      const key = { wallet: account.ss58, groupId, handler };
      await this.incidents.handle(message, alerts, key, blockNumber);
    }
  }

  @Event(H.TransferEgress, [Chain.Polkadot, Chain.Kusama], 'balances.Transfer')
  async balancesTransferEgress({
    eventRecord,
    blockNumber,
    handler,
  }: EventHandlerParams<H.TransferEgress>): Promise<void> {
    const [from, to, amount] = eventRecord.event.data.map(item => item.toString());

    for (const { account, alerts, groupId } of this.reg.getAccounts(handler, from)) {
      const message = this.fmt.message(
        [
          `${this.fmt.accountLink(account)} sent ${this.fmt.balance(amount)}`,
          `To: ${this.fmt.accountLink({ ss58: to, name: to, hex: '' })}`,
        ],
        { blockNumber, phase: eventRecord.phase },
      );
      const key = { wallet: account.ss58, groupId, handler };
      await this.incidents.handle(message, alerts, key, blockNumber);
    }
  }
}
