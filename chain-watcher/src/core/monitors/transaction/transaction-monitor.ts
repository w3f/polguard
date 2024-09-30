import { ApiPromise } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { BlockHash } from '@polkadot/types/interfaces';
import { AbstractMonitor } from '../abstract-monitor';
import { MonitoringGroup } from '../../interfaces';
import { EventHandler } from '../decorators';
import { MonitorType } from '../../constants';
import { IncidentHandler } from '../../incident/incident-handler';
import { ChainWatcherStore } from '@core/store/chain-watcher-store';

abstract class TransactionMonitor extends AbstractMonitor {
  constructor(
    api: ApiPromise,
    groups: MonitoringGroup[],
    protected incidentHandler: IncidentHandler,
    store: ChainWatcherStore,
    protected monitorType: MonitorType
  ) {
    super(api, groups, incidentHandler, store);
  }

  @EventHandler('balances.Transfer')
  async handleBalancesTransfer(eventRecord: EventRecord, blockHash: BlockHash, blockNumber: number): Promise<void> {
    const [from, to, amount] = eventRecord.event.data.map((item) => item.toString());

    const matches = this.monitorType === MonitorType.TransactionIngress
      ? this.getGroups(to) : this.getGroups(from);

    for (const { account, group } of matches) {
      const action = this.monitorType === MonitorType.TransactionIngress ? 'received in' : 'sent from';
      const message = `New Transfer of ${this.formatBalance(amount)} ${action} account "${account}". Details: ${this.getEventLink(
        blockHash,
        eventRecord.phase
      )}`;
      const incidentKey = `${account.ss58}:${group.name}:handleBalancesTransfer`;
      await this.incidentHandler.handleInstantIncident(
        incidentKey,
        message,
        group.alerts,
        blockNumber
      );
    }
  }
}
export class TransactionIngressMonitor extends TransactionMonitor {
  constructor(api: ApiPromise, groups: MonitoringGroup[], incidentHandler: IncidentHandler, store: ChainWatcherStore) {
    super(api, groups, incidentHandler, store, MonitorType.TransactionIngress);
  }
}
export class TransactionEgressMonitor extends TransactionMonitor {
  constructor(api: ApiPromise, groups: MonitoringGroup[], incidentHandler: IncidentHandler, store: ChainWatcherStore) {
    super(api, groups, incidentHandler, store, MonitorType.TransactionEgress);
  }
}
