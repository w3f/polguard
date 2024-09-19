import { ApiPromise } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { BlockHash } from '@polkadot/types/interfaces';
import { AbstractMonitor } from '../abstract-monitor';
import { Incident, MonitoringGroup, AccountId, AlertSettings } from '../../interfaces';
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
      isSent: boolean,
      alerts: AlertSettings
    ): Incident => {
      const clonedAlerts = JSON.parse(JSON.stringify(alerts));
      
      // We do not want to escalate ingress transactions
      if (!isSent) {
        // This owerwrites config which is suboptimal and is temporary decision.
        // TODO: potentially move this to the config or handle in different way
        clonedAlerts.matrix.escalation = null;
      }

      const action = isSent ? 'sent from' : 'received in';

      return {
        message: `New Transfer of ${this.formatBalance(amount)} ${action} account "${account.name}". Details: ${this.getEventLink(
          blockHash,
          eventRecord.phase
        )}`,
        alerts: clonedAlerts,
      }
    };

    const fromMatches = this.accountGroups.get(from) || [];
    const toMatches = this.accountGroups.get(to) || [];

    fromMatches.forEach(({ account, group }) => {
      this.emitIncident(
        createIncident(account, true, group.alerts)
      );
    });

    toMatches.forEach(({ account, group }) => {
      this.emitIncident(
        createIncident(account, false, group.alerts)
      );
    });


  }

}
