import { ApiPromise } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { BlockHash } from '@polkadot/types/interfaces';
import { AbstractMonitor } from '../abstract-monitor';
import { HandlerContext, Incident, MonitoringGroup } from '../../interfaces';
import { EventHandler } from '../decorators';
import { EventEmitter } from 'events';


export class ValidatorMonitor extends AbstractMonitor {
  constructor(
    api: ApiPromise,
    groups: MonitoringGroup[],
    incidentEmitter: EventEmitter
  ) {
    super(api, groups, incidentEmitter);
  }

  @EventHandler('staking.SlashReported')
  async handleSlashReported(eventRecord: EventRecord, blockHash: BlockHash): Promise<void> {
    const validatorId = eventRecord.event.data[0].toString();
    const matches = this.accountGroups.get(validatorId) || [];

    for (const { account, group } of matches) {
      const incident: Incident = {
        message: `Validator ${account.name} has been slashed. Details: ${this.getEventLink(
          blockHash,
          eventRecord.phase
        )}`,
        alerts: group.alerts,
      };
      this.emitIncident(incident);
    }
  }
  
}
