import { ApiPromise } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { AbstractMonitor } from '../abstract-monitor';
import { EventDispatcher, HandlerContext, Incident, MonitoringGroup } from '../../interfaces';
import { EventHandler } from '../decorators';


export class GovernanceMonitor extends AbstractMonitor {

  @EventHandler('test.Test')
  async handleTestTest(context: HandlerContext<EventRecord>): Promise<Incident[]> {
    return [];
  }
}
