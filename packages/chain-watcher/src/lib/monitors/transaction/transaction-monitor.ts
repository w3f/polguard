import { AbstractMonitor } from '../abstract-monitor';
import { Chain, EventHandlerParams, MonitorType, TransactionHandlerType as H } from '@w3f/monitoring-types';
import { EventHandler } from '../../decorators';

abstract class TransactionMonitor<
  T extends MonitorType.TransactionIngress | MonitorType.TransactionEgress,
> extends AbstractMonitor<T> {
  protected abstract getAddress(from: string, to: string): string;
  protected abstract getActionDescription(): string;

  @EventHandler('balances.Transfer', [Chain.Polkadot, Chain.Kusama])
  async balancesTransfer({ eventRecord, blockNumber }: EventHandlerParams): Promise<void> {
    const [from, to, amount] = eventRecord.event.data.map(item => item.toString());
    const address = this.getAddress(from, to);

    for (const { account, alerts } of this.getAccounts(H.BalancesTransfer, address)) {
      this.logger.debug(`BalancesTransfer: ${from} -> ${to}: ${amount}`);

      const message = this.createMessage([
        `New Transfer of ${this.formatBalance(amount)} ${this.getActionDescription()} account "${account.name}".`,
        `Details: ${this.getEventLink(blockNumber, eventRecord.phase)}`,
      ]);

      await this.incidents.oneTimeIncident(message, alerts, blockNumber);
    }
  }
}

export class TransactionIngressMonitor extends TransactionMonitor<MonitorType.TransactionIngress> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getAddress(from: string, to: string): string {
    return to;
  }

  protected getActionDescription(): string {
    return 'received in';
  }
}

export class TransactionEgressMonitor extends TransactionMonitor<MonitorType.TransactionEgress> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getAddress(from: string, to: string): string {
    return from;
  }

  protected getActionDescription(): string {
    return 'sent from';
  }
}
