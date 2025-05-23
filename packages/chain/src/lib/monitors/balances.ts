import {
  Chain,
  StateHandlerParams,
  MonitorType,
  BalancesHandlerType as H,
  EventHandlerParams,
  CallHandlerParams,
} from '@w3f/monitoring-types';
import { Call, Event, State } from '../decorators';
import { AbstractMonitor } from './abstract-monitor';

export class BalancesMonitor extends AbstractMonitor<MonitorType.Balances> {
  @State(H.BalanceDecrease, [Chain.Polkadot, Chain.Kusama])
  async balanceDecrease({ blockNumber, handlerType }: StateHandlerParams<H.BalanceDecrease>): Promise<void> {
    const addresses = this.reg.getUniqueAddresses();
    const [curr, prev] = await Promise.all([
      await this.chain.systemAccountBalance(addresses, blockNumber),
      await this.chain.systemAccountBalance(addresses, blockNumber - 1),
    ]);

    for (const address of addresses) {
      const currentBalance = curr[address];
      const previousBalance = prev[address];

      for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, address)) {
        const message = this.fmt.message(
          [
            `Balance changed for ${this.fmt.accountLink(account.name, account.ss58)}`,
            `Previous: ${this.fmt.balance(previousBalance)}`,
            `Current: ${this.fmt.balance(currentBalance)}`,
          ],
          { blockNumber },
        );
        // TODO: We will implement a flexible value definition system so we can use BalanceChange
        // instead of two BalanceDecrease, BalanceIncrease
        // See: https://github.com/w3f/monitoring-platform/issues/69
        if (currentBalance < previousBalance) {
          const key = { account: account.ss58, groupId, handlerType };
          await this.incidents.handle(message, notifications, key, blockNumber);
        }
      }
    }
  }

  @State(H.BalanceThreshold, [Chain.Polkadot, Chain.Kusama])
  async balanceThreshold({ blockNumber, handlerType }: StateHandlerParams<H.BalanceThreshold>): Promise<void> {
    const addresses = this.reg.getUniqueAddresses();
    const cur = await this.chain.systemAccountBalance(addresses, blockNumber);

    for (const address of addresses) {
      const currentBalance = cur[address];
      for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, address)) {
        if (!account.settings.threshold) continue;

        const message = this.fmt.message(
          [
            `Balance for ${this.fmt.accountLink(account.name, account.ss58)} is below threshold.`,
            `Current balance: ${this.fmt.balance(currentBalance)}`,
            `Threshold: ${this.fmt.balance(account.settings.threshold)}`,
          ],
          { blockNumber },
        );
        const key = { account: account.ss58, groupId, handlerType };
        const isFiring = currentBalance < account.settings.threshold;
        await this.incidents.handle(message, notifications, key, blockNumber, isFiring);
      }
    }
  }

  // This handler was added just for testing purposes (multisig, proxy, nested calls)
  // TODO: Should follow same approach as event-based handler: Ingress, Egress
  @Call(H.Transfer, [Chain.Polkadot, Chain.Kusama], 'balances.transfer')
  async balancesTransfer({
    call,
    origin,
    blockNumber,
    extrinsicIndex,
    handlerType,
  }: CallHandlerParams<H.Transfer>): Promise<void> {
    const [to, amount] = call.args.map(arg => arg.toString());
    for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, origin)) {
      const message = this.fmt.message(
        [
          `${this.fmt.accountLink(account.name, account.ss58)} initiated a transfer of ${this.fmt.balance(amount)}`,
          `To: ${this.fmt.accountLink(to, to)}`,
        ],
        { blockNumber, extrinsicIndex },
      );

      const key = { account: account.ss58, groupId, handlerType };
      await this.incidents.handle(message, notifications, key, blockNumber);
    }
  }

  @Event(H.TransferIngress, [Chain.Polkadot, Chain.Kusama], 'balances.Transfer')
  async balancesTransferIngress({
    eventRecord,
    blockNumber,
    handlerType,
  }: EventHandlerParams<H.TransferIngress>): Promise<void> {
    const [from, to, amount] = eventRecord.event.data.map(item => item.toString());

    for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, to)) {
      const message = this.fmt.message(
        [
          `${this.fmt.accountLink(account.name, account.ss58)} received ${this.fmt.balance(amount)}`,
          `From: ${this.fmt.accountLink(from, from)}`,
        ],
        { blockNumber, phase: eventRecord.phase },
      );
      const key = { account: account.ss58, groupId, handlerType };
      await this.incidents.handle(message, notifications, key, blockNumber);
    }
  }

  @Event(H.TransferEgress, [Chain.Polkadot, Chain.Kusama], 'balances.Transfer')
  async balancesTransferEgress({
    eventRecord,
    blockNumber,
    handlerType,
  }: EventHandlerParams<H.TransferEgress>): Promise<void> {
    const [from, to, amount] = eventRecord.event.data.map(item => item.toString());

    for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, from)) {
      const message = this.fmt.message(
        [
          `${this.fmt.accountLink(account.name, account.ss58)} sent ${this.fmt.balance(amount)}`,
          `To: ${this.fmt.accountLink(to, to)}`,
        ],
        { blockNumber, phase: eventRecord.phase },
      );
      const key = { account: account.ss58, groupId, handlerType };
      await this.incidents.handle(message, notifications, key, blockNumber);
    }
  }
}
