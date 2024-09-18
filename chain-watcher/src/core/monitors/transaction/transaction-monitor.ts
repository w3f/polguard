import { ApiPromise } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { BlockHash } from '@polkadot/types/interfaces';
import { AbstractMonitor } from '../abstract-monitor';
import { Incident, MonitoringGroup, AccountId } from '../../interfaces';
import { EventHandler } from '../decorators';
import EventEmitter from 'events';


export class TransactionMonitor extends AbstractMonitor {
  constructor(
    api: ApiPromise,
    groups: MonitoringGroup[],
    incidentEmitter: EventEmitter
  ) {
    super(api, groups, incidentEmitter);
  }

  @EventHandler('balances.Transfer')
  async handleBalancesTransfer(eventRecord: EventRecord, blockHash: BlockHash): Promise<void> {
    const [from, to, amount] = eventRecord.event.data.map((item) => item.toString());

    const createIncident = (
      account: AccountId,
      action: string,
      group: MonitoringGroup
    ): Incident => ({
      message: `New Transfer of ${this.formatBalance(amount)} ${action} account "${account.name}". Details: ${this.getEventLink(
        blockHash,
        eventRecord.phase
      )}`,
      alerts: group.alerts,
    });

    const fromMatches = this.accountGroups.get(from) || [];
    const toMatches = this.accountGroups.get(to) || [];

    for (const { account, group } of fromMatches) {
      this.emitIncident(
        createIncident(account, 'sent from', group)
      );
    }

    for (const { account, group } of toMatches) {
      this.emitIncident(
        createIncident(account, 'received in', group)
      );
    }

    // TODO: Let's not yet flud config with ingress_ack = False, but for now handle it directly here.
    // Later we could add it to the config if make sense.
  }

}
