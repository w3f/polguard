import { ApiPromise } from '@polkadot/api';
import { PalletBalancesEvent } from '@polkadot/types/lookup';
import { AbstractMonitor } from '../abstract-monitor';
import { EventHandlerParams, Logger, MonitoringGroup } from '../../interfaces';
import { EventHandler } from '../decorators';
import { MonitorType } from '../../constants';
import { IncidentHandler } from '../../incident/incident-handler';
import { ChainWatcherStore } from '../../store/chain-watcher-store';

abstract class TransactionMonitor extends AbstractMonitor {
  constructor(
    logger: Logger,
    api: ApiPromise,
    groups: MonitoringGroup[],
    protected incidentHandler: IncidentHandler,
    store: ChainWatcherStore,
    protected monitorType: MonitorType
  ) {
    super(logger, api, groups, incidentHandler, store);
  }

  @EventHandler('balances.Transfer')
  async handleBalancesTransfer({ eventRecord, blockHash, blockNumber }: EventHandlerParams): Promise<void> {
    const [from, to, amount] = eventRecord.event.data.map((item) => item.toString());
    const matches = this.monitorType === MonitorType.TransactionIngress
      ? this.getGroups(to) : this.getGroups(from);

    for (const { account, group } of matches) {
      this.logger.debug(`BalancesTransfer: ${from} -> ${to}: ${amount}`);
      const action = this.monitorType === MonitorType.TransactionIngress ? 'received in' : 'sent from';
      const message = `New Transfer of ${this.formatBalance(amount)} ` +
                      `${action} account "${account.name}". ` +
                      `Details: ${await this.getEventLink(blockNumber, eventRecord.phase)}`;
      await this.incidents.oneTimeIncident(message, group.alerts, blockNumber);
    }
  }
}
export class TransactionIngressMonitor extends TransactionMonitor {
  constructor(logger: Logger, api: ApiPromise, groups: MonitoringGroup[], incidentHandler: IncidentHandler, store: ChainWatcherStore) {
    super(logger, api, groups, incidentHandler, store, MonitorType.TransactionIngress);
  }
}
export class TransactionEgressMonitor extends TransactionMonitor {
  constructor(logger: Logger, api: ApiPromise, groups: MonitoringGroup[], incidentHandler: IncidentHandler, store: ChainWatcherStore) {
    super(logger, api, groups, incidentHandler, store, MonitorType.TransactionEgress);
  }
}
