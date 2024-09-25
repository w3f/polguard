import { ApiPromise } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { BlockHash } from '@polkadot/types/interfaces';
import { AbstractMonitor } from '../abstract-monitor';
import { Incident, MonitoringGroup, AlertSettings, EventDispatcher, AccountSettings } from '../../interfaces';
import { EventHandler } from '../decorators';
import { MonitorType } from '@core/constants';


abstract class TransactionMonitor extends AbstractMonitor {

  constructor(
    api: ApiPromise,
    groups: MonitoringGroup[],
    eventDispatcher: EventDispatcher,
    protected monitorType: MonitorType
  ) {
    super(api, groups, eventDispatcher);
  }

  @EventHandler('balances.Transfer')
  async handleBalancesTransfer(eventRecord: EventRecord, blockHash: BlockHash): Promise<void> {
    const [from, to, amount] = eventRecord.event.data.map((item) => item.toString());

    const createTransferIncident = (
      account: AccountSettings,
      alerts: AlertSettings
    ): Incident => {
      const action = this.monitorType === MonitorType.TransactionIngress ? 'received in' : 'sent from';

      return {
        message: `New Transfer of ${this.formatBalance(amount)} ${action} account "${account}". Details: ${this.getEventLink(
          blockHash,
          eventRecord.phase
        )}`,
        alerts: alerts,
      };
    };

    const matches = this.monitorType === MonitorType.TransactionIngress
      ? this.getGroups(to) : this.getGroups(from);

    for (const { account, group } of matches) {
      const incident = createTransferIncident(account, group.alerts);
      await this.eventDispatcher.emitIncident(incident);
    }
  }
}

export class TransactionIngressMonitor extends TransactionMonitor {
  constructor(api: ApiPromise, groups: MonitoringGroup[], eventDispatcher: EventDispatcher) {
    super(api, groups, eventDispatcher, MonitorType.TransactionIngress);
  }
}

export class TransactionEgressMonitor extends TransactionMonitor {
  constructor(api: ApiPromise, groups: MonitoringGroup[], eventDispatcher: EventDispatcher) {
    super(api, groups, eventDispatcher, MonitorType.TransactionEgress);
  }
}
