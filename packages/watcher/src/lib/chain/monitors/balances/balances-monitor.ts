import {
  Chain,
  StateHandlerParams,
  MonitorType,
  BalancesHandlerType as H,
  EventHandlerParams,
} from '@w3f/monitoring-types';
import { Event, State, IncidentPayload } from '../../../common/decorators';
import { AbstractChainMonitor } from '../abstract-chain-monitor';

export class BalancesMonitor extends AbstractChainMonitor<MonitorType.Balances> {
  @State(H.BalanceChange, [Chain.Polkadot, Chain.Kusama])
  async balanceChange({ blockNumber, handler }: StateHandlerParams<H.BalanceChange>): Promise<IncidentPayload[]> {
    const currentBalances = await this.provider.systemAccountBalance(this.uniqueAddresses, blockNumber);
    const previousBalances = await this.provider.systemAccountBalance(this.uniqueAddresses, blockNumber - 1);
    const incidents: IncidentPayload[] = [];

    for (const address of this.uniqueAddresses) {
      const currentBalance = currentBalances[address];
      const previousBalance = previousBalances[address];

      for (const { account, alerts, groupId } of this.getAccounts(handler, address)) {
        const compareFunc = BalancesMonitor.comparisonFunctions[account.settings.changeComparison];
        const message = this.createMessage(
          [
            `Balance changed for ${this.formatAccountLink(account)}`,
            `Previous: ${this.formatBalance(previousBalance)}`,
            `Current: ${this.formatBalance(currentBalance)}`,
          ],
          { blockNumber },
        );
        if (compareFunc(currentBalance, previousBalance)) {
          const key = { wallet: account.ss58, groupId, handler };
          incidents.push({ message, alerts, key, blockNumber });
        }
      }
    }
    return incidents;
  }

  @State(H.BalanceThreshold, [Chain.Polkadot, Chain.Kusama])
  async balanceThreshold({ blockNumber, handler }: StateHandlerParams<H.BalanceThreshold>): Promise<IncidentPayload[]> {
    const currentBalances = await this.provider.systemAccountBalance(this.uniqueAddresses, blockNumber);
    const incidents: IncidentPayload[] = [];

    for (const address of this.uniqueAddresses) {
      const currentBalance = currentBalances[address];
      for (const { account, alerts, groupId } of this.getAccounts(handler, address)) {
        if (!account.settings.threshold) continue;

        const message = this.createMessage(
          [
            `Balance for ${this.formatAccountLink(account)} is below threshold.`,
            `Current balance: ${this.formatBalance(currentBalance)}`,
            `Threshold: ${this.formatBalance(account.settings.threshold)}`,
          ],
          { blockNumber },
        );
        const key = { wallet: account.ss58, groupId, handler };
        const isFiring = currentBalance < account.settings.threshold;
        incidents.push({ message, alerts, key, blockNumber, isFiring });
      }
    }
    return incidents;
  }

  @Event(H.TransferIngress, [Chain.Polkadot, Chain.Kusama], 'balances.Transfer')
  async balancesTransferIngress({
    eventRecord,
    blockNumber,
    handler,
  }: EventHandlerParams<H.TransferIngress>): Promise<IncidentPayload[]> {
    const [from, to, amount] = eventRecord.event.data.map(item => item.toString());
    const incidents: IncidentPayload[] = [];

    for (const { account, alerts, groupId } of this.getAccounts(handler, to)) {
      const message = this.createMessage(
        [
          `${this.formatAccountLink(account)} received ${this.formatBalance(amount)}`,
          `From: ${this.formatLink(from, this.getAccountLink(from))}`,
        ],
        { blockNumber, phase: eventRecord.phase },
      );
      const key = { wallet: account.ss58, groupId, handler };
      incidents.push({ message, alerts, key, blockNumber });
    }
    return incidents;
  }

  @Event(H.TransferEgress, [Chain.Polkadot, Chain.Kusama], 'balances.Transfer')
  async balancesTransferEgress({
    eventRecord,
    blockNumber,
    handler,
  }: EventHandlerParams<H.TransferEgress>): Promise<IncidentPayload[]> {
    const [from, to, amount] = eventRecord.event.data.map(item => item.toString());
    const incidents: IncidentPayload[] = [];

    for (const { account, alerts, groupId } of this.getAccounts(handler, from)) {
      const message = this.createMessage(
        [
          `${this.formatAccountLink(account)} sent ${this.formatBalance(amount)}`,
          `To: ${this.formatLink(to, this.getAccountLink(to))}`,
        ],
        { blockNumber, phase: eventRecord.phase },
      );
      const key = { wallet: account.ss58, groupId, handler };
      incidents.push({ message, alerts, key, blockNumber });
    }
    return incidents;
  }
}
