import {
  Chain,
  EveryBlockHandlerParams,
  MonitorType,
  BalancesHandlerType as H,
  EventHandlerParams,
} from '@w3f/monitoring-types';
import { EventHandler, EveryBlockHandler } from '../../decorators';
import { AbstractMonitor } from '../abstract-monitor';

export class BalancesMonitor extends AbstractMonitor<MonitorType.Balances> {
  @EveryBlockHandler([Chain.Polkadot, Chain.Kusama])
  async balanceChange({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const currentBalances = await this.stateQuery.systemAccountBalance(this.uniqueAddresses, blockNumber);
    const previousBalances = await this.stateQuery.systemAccountBalance(this.uniqueAddresses, blockNumber - 1);

    for (const address of this.uniqueAddresses) {
      const currentBalance = currentBalances[address];
      const previousBalance = previousBalances[address];

      for (const { account, alerts, groupId } of this.getAccounts(H.BalanceChange, address)) {
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

        const key = `${account.ss58}:${groupId}:${H.BalanceChange}`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }

  @EveryBlockHandler([Chain.Polkadot, Chain.Kusama])
  async balanceThreshold({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const currentBalances = await this.stateQuery.systemAccountBalance(this.uniqueAddresses, blockNumber);

    for (const address of this.uniqueAddresses) {
      const currentBalance = currentBalances[address];
      for (const { account, alerts, groupId } of this.getAccounts(H.BalanceThreshold, address)) {
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

        const key = `${account.ss58}:${groupId}:${H.BalanceThreshold}`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }

  @EventHandler('balances.Transfer', [Chain.Polkadot, Chain.Kusama])
  async balancesTransferIngress({ eventRecord, blockNumber }: EventHandlerParams): Promise<void> {
    const [from, to, amount] = eventRecord.event.data.map(item => item.toString());

    for (const { account, alerts } of this.getAccounts(H.TransferIngress, to)) {
      this.logger.debug(`BalancesTransfer: ${from} -> ${to}: ${amount}`);

      const message = this.createMessage(
        [
          `${this.formatAccountLink(account)} received ${this.formatBalance(amount)}`,
          `From: ${this.formatLink(from, this.getAccountLink(from))}`,
        ],
        { blockNumber, phase: eventRecord.phase },
      );

      await this.incidents.oneTimeIncident(message, alerts, blockNumber);
    }
  }

  @EventHandler('balances.Transfer', [Chain.Polkadot, Chain.Kusama])
  async balancesTransferEgress({ eventRecord, blockNumber }: EventHandlerParams): Promise<void> {
    const [from, to, amount] = eventRecord.event.data.map(item => item.toString());

    for (const { account, alerts } of this.getAccounts(H.TransferEgress, from)) {
      this.logger.debug(`BalancesTransfer: ${from} -> ${to}: ${amount}`);

      const message = this.createMessage(
        [
          `${this.formatAccountLink(account)} sent ${this.formatBalance(amount)}`,
          `To: ${this.formatLink(to, this.getAccountLink(to))}`,
        ],
        { blockNumber, phase: eventRecord.phase },
      );

      await this.incidents.oneTimeIncident(message, alerts, blockNumber);
    }
  }
}
