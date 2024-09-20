import { EventRecord } from '@polkadot/types/interfaces/system';
import { BlockHash } from '@polkadot/types/interfaces';
import { AbstractMonitor } from '../abstract-monitor';
import { EventHandler } from '../decorators';

export class GovernanceMonitor extends AbstractMonitor {

  @EventHandler('placeholder.Placeholder')
  async handleSlashReported(eventRecord: EventRecord, blockHash: BlockHash): Promise<void> {

  }
  
}
