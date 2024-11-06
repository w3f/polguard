import { AbstractMonitor } from '../abstract-monitor';
import { EventHandlerParams } from '../../interfaces';
import { EventHandler } from '../decorators';
import { MonitorType } from '../../constants';

abstract class TransactionMonitor<T extends MonitorType> extends AbstractMonitor<T> {
  protected abstract getAddress(from: string, to: string): string;
  protected abstract getActionDescription(): string;

  @EventHandler('balances.Transfer')
  async handleBalancesTransfer({ eventRecord, blockNumber }: EventHandlerParams): Promise<void> {
    const [from, to, amount] = eventRecord.event.data.map((item) => item.toString());
    const address = this.getAddress(from, to);

    for (const { account, alerts } of this.getAccounts(address)) {
      this.logger.debug(`BalancesTransfer: ${from} -> ${to}: ${amount}`);

      const message = this.createMessage([
        `New Transfer of ${this.formatBalance(amount)} ${this.getActionDescription()} account "${account.name}".`,
        `Details: ${this.getEventLink(blockNumber, eventRecord.phase)}`
      ]);

      await this.incidents.oneTimeIncident(message, alerts, blockNumber);
    }
  }
}

export class TransactionIngressMonitor extends TransactionMonitor<MonitorType.TransactionIngress> {
  protected getAddress(from: string, to: string): string {
    return to;
  }

  protected getActionDescription(): string {
    return 'received in';
  }
}

export class TransactionEgressMonitor extends TransactionMonitor<MonitorType.TransactionEgress> {
  protected getAddress(from: string, to: string): string {
    return from;
  }

  protected getActionDescription(): string {
    return 'sent from';
  }
}
