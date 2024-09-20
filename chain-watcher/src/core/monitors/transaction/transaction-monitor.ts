import { ApiPromise } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { BlockHash } from '@polkadot/types/interfaces';
import { AbstractMonitor } from '../abstract-monitor';
import { Incident, MonitoringGroup, AlertSettings, EventDispatcher, AccountSettings } from '../../interfaces';
import { EventHandler } from '../decorators';
import { TransactionType } from '../../constants';

abstract class TransactionMonitor extends AbstractMonitor {
  protected transactionType: TransactionType;

  constructor(
    api: ApiPromise,
    groups: MonitoringGroup[],
    eventDispatcher: EventDispatcher,
    transactionType: TransactionType
  ) {
    super(api, groups, eventDispatcher);
    this.transactionType = transactionType;
  }

  @EventHandler('balances.Transfer')
  async handleBalancesTransfer(eventRecord: EventRecord, blockHash: BlockHash): Promise<void> {
    const [from, to, amount] = eventRecord.event.data.map((item) => item.toString());

    const createTransferIncident = (
      account: AccountSettings,
      alerts: AlertSettings
    ): Incident => {
      const action = this.transactionType === TransactionType.Ingress ? 'received in' : 'sent from';

      return {
        message: `New Transfer of ${this.formatBalance(amount)} ${action} account "${account.name}". Details: ${this.getEventLink(
          blockHash,
          eventRecord.phase
        )}`,
        alerts: alerts,
      };
    };

    const matches = this.transactionType === TransactionType.Ingress
      ? this.getGroups(to) : this.getGroups(from);

    matches.forEach(({ account, group }) => {
      const incident = createTransferIncident(account, group.alerts);
      this.emitIncident(incident);
    });
  }
}

export class TransactionIngressMonitor extends TransactionMonitor {
  constructor(api: ApiPromise, groups: MonitoringGroup[], eventDispatcher: EventDispatcher) {
    super(api, groups, eventDispatcher, TransactionType.Ingress);
  }
}

export class TransactionEgressMonitor extends TransactionMonitor {
  constructor(api: ApiPromise, groups: MonitoringGroup[], eventDispatcher: EventDispatcher) {
    super(api, groups, eventDispatcher, TransactionType.Egress);
  }
}
