import {
  Chain,
  MonitorType,
  BalancesHandlerType as H,
  EventHandlerParams,
  CallHandlerParams,
} from '../../types';
import { Call, Event, State } from '../decorators';
import { resolveMultiAddress } from '../utils';
import { AbstractMonitor } from './abstract-monitor';

export class BalancesMonitor extends AbstractMonitor<MonitorType.Balances> {
  @State(H.BalanceDecreaseState, [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.Frequency, Chain.AssetHubPaseo])
  async balanceDecrease(): Promise<void> {
    const { blockNumber } = this.block;
    const addresses = this.reg.getUniqueAddresses();
    const [curr, prev] = await Promise.all([
      this.chain.systemAccountBalance(addresses, blockNumber),
      this.chain.systemAccountBalance(addresses, blockNumber - 1),
    ]);

    for (const a of this.watched()) {
      const currentBalance = curr[a.ss58];
      const previousBalance = prev[a.ss58];
      // TODO: We will implement a flexible value definition system so we can use BalanceChange
      // instead of two BalanceDecrease, BalanceIncrease
      // See: https://github.com/w3f/polguard/issues/69
      if (currentBalance < previousBalance) {
        await a.report('Balance decreased', [
          `Previous: ${this.balance(previousBalance)}`,
          `Current: ${this.balance(currentBalance)}`,
        ]);
      }
    }
  }

  @State(H.BalanceThresholdState, [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.Frequency, Chain.AssetHubPaseo])
  async balanceThreshold(): Promise<void> {
    const cur = await this.chain.systemAccountBalance(this.reg.getUniqueAddresses(), this.block.blockNumber);

    for (const a of this.watched()) {
      const threshold = a.settings.threshold;
      if (!threshold) continue;

      const currentBalance = cur[a.ss58];
      await a.track(
        'Balance below threshold',
        [`Threshold: ${this.balance(threshold)}`, `Balance: ${this.balance(currentBalance)}`],
        currentBalance < threshold,
      );
    }
  }

  // This handler was added just for testing purposes (multisig, proxy, nested calls)
  // TODO: Should follow same approach as event-based handler: Ingress, Egress
  @Call(
    H.TransferCall,
    [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.Frequency, Chain.AssetHubPaseo],
    ['Balances.transfer_allow_death', 'Balances.transfer_keep_alive'],
  )
  async balancesTransfer({ call, origin }: CallHandlerParams<H.TransferCall>): Promise<void> {
    const args = call.value.value;
    const to = resolveMultiAddress(args.dest);
    const amount = String(args.value);

    for (const a of this.matched(origin)) await a.report(`Sent ${this.balance(amount)}`, [`To: ${this.accountRef(to)}`]);
  }

  @Event(
    H.TransferIngressEvent,
    [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.Frequency, Chain.AssetHubPaseo],
    'balances.Transfer',
  )
  async balancesTransferIngress({ payload }: EventHandlerParams<H.TransferIngressEvent>): Promise<void> {
    const { from, to, amount } = payload;
    for (const a of this.matched(to)) await a.report(`Received ${this.balance(amount)}`, [`From: ${this.accountRef(from)}`]);
  }

  @Event(
    H.TransferEgressEvent,
    [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.Frequency, Chain.AssetHubPaseo],
    'balances.Transfer',
  )
  async balancesTransferEgress({ payload }: EventHandlerParams<H.TransferEgressEvent>): Promise<void> {
    const { from, to, amount } = payload;
    for (const a of this.matched(from)) await a.report(`Sent ${this.balance(amount)}`, [`To: ${this.accountRef(to)}`]);
  }
}
