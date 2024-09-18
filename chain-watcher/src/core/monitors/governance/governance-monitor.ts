import { ApiPromise } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { AbstractMonitor } from '../abstract-monitor';
import { HandlerContext, Incident, MonitoringGroup } from '../../interfaces';
import { EventHandler } from '../decorators';
import EventEmitter from 'events';


export class GovernanceMonitor extends AbstractMonitor {
  constructor(
    api: ApiPromise,
    groups: MonitoringGroup[],
    incidentEmitter: EventEmitter
  ) {
    super(api, groups, incidentEmitter);
  }

  @EventHandler('test.Test')
  async handleTestTest(context: HandlerContext<EventRecord>): Promise<Incident[]> {
    return [];
  }
}
