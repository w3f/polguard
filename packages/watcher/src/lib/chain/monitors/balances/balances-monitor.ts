import {
  Chain,
  StateHandlerParams,
  MonitorType,
  BalancesHandlerType as H,
  EventHandlerParams,
  IncidentKey,
} from '@w3f/monitoring-types';
import { Event, State, Handler } from '../../../common/decorators';
import { AbstractChainMonitor } from '../abstract-chain-monitor';

export class BalancesMonitor extends AbstractChainMonitor<MonitorType.Balances> {
  @State([Chain.Polkadot, Chain.Kusama])
  @Handler(H.BalanceChange)
  async balanceChange({ blockNumber, handler }: StateHandlerParams<H>): Promise<void> {
    const currentBalances = await this.provider.systemAccountBalance(this.uniqueAddresses, blockNumber);
    const previousBalances = await this.provider.systemAccountBalance(this.uniqueAddresses, blockNumber - 1);

    for (const address of this.uniqueAddresses) {
      const currentBalance = currentBalances[address];
      const previousBalance = previousBalances[address];

      for (const { account, alerts, groupId } of this.getAccounts(handler, address)) {
        const compareFunc = BalancesMonitor.comparisonFunctions[account.settings.changeComparison];
        const isFiring = compareFunc(currentBalance, previousBalance);
        const message = this.createMessage(
          [
            `Balance changed for ${this.formatAccountLink(account)}`,
            `Previous: ${this.formatBalance(previousBalance)}`,
            `Current: ${this.formatBalance(currentBalance)}`,
          ],
          { blockNumber },
        );
        const key: IncidentKey = { wallet: account.ss58, groupId, handler };
        await this.incidents.ongoingIncident(message, alerts, isFiring, key, blockNumber);
      }
    }
  }

  @State([Chain.Polkadot, Chain.Kusama])
  @Handler(H.BalanceThreshold)
  async balanceThreshold({ blockNumber, handler }: StateHandlerParams<H>): Promise<void> {
    const currentBalances = await this.provider.systemAccountBalance(this.uniqueAddresses, blockNumber);

    for (const address of this.uniqueAddresses) {
      const currentBalance = currentBalances[address];
      for (const { account, alerts, groupId } of this.getAccounts(handler, address)) {
        if (!account.settings.threshold) continue;
        const isFiring = currentBalance < account.settings.threshold;
        const message = this.createMessage(
          [
            `Balance for ${this.formatAccountLink(account)} is below threshold.`,
            `Current balance: ${this.formatBalance(currentBalance)}`,
            `Threshold: ${this.formatBalance(account.settings.threshold)}`,
          ],
          { blockNumber },
        );
        const key: IncidentKey = { wallet: account.ss58, groupId, handler };
        await this.incidents.ongoingIncident(message, alerts, isFiring, key, blockNumber);
      }
    }
  }

  @Event('balances.Transfer', [Chain.Polkadot, Chain.Kusama])
  @Handler(H.TransferIngress)
  async balancesTransferIngress({ eventRecord, blockNumber, handler }: EventHandlerParams<H>): Promise<void> {
    const [from, to, amount] = eventRecord.event.data.map(item => item.toString());

    for (const { account, alerts, groupId } of this.getAccounts(handler, to)) {
      const message = this.createMessage(
        [
          `${this.formatAccountLink(account)} received ${this.formatBalance(amount)}`,
          `From: ${this.formatLink(from, this.getAccountLink(from))}`,
        ],
        { blockNumber, phase: eventRecord.phase },
      );
      const key: IncidentKey = { wallet: account.ss58, groupId, handler };
      await this.incidents.oneTimeIncident(message, alerts, key, blockNumber);
    }
  }

  @Event('balances.Transfer', [Chain.Polkadot, Chain.Kusama])
  @Handler(H.TransferEgress)
  async balancesTransferEgress({ eventRecord, blockNumber, handler }: EventHandlerParams<H>): Promise<void> {
    const [from, to, amount] = eventRecord.event.data.map(item => item.toString());

    for (const { account, alerts, groupId } of this.getAccounts(handler, from)) {
      const message = this.createMessage(
        [
          `${this.formatAccountLink(account)} sent ${this.formatBalance(amount)}`,
          `To: ${this.formatLink(to, this.getAccountLink(to))}`,
        ],
        { blockNumber, phase: eventRecord.phase },
      );
      const key: IncidentKey = { wallet: account.ss58, groupId, handler };
      await this.incidents.oneTimeIncident(message, alerts, key, blockNumber);
    }
  }
}
