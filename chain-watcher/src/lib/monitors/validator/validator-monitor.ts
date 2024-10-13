import { EventRecord } from '@polkadot/types/interfaces/system';
import { BlockHash } from '@polkadot/types/interfaces';
import { AbstractMonitor } from '../abstract-monitor';
import { EventHandler } from '../decorators';

export class ValidatorMonitor extends AbstractMonitor {

  @EventHandler('staking.SlashReported')
  async handleSlashReported(eventRecord: EventRecord, blockHash: BlockHash, blockNumber: number): Promise<void> {
    const validatorId = eventRecord.event.data[0].toString();
    const matches = this.getGroups(validatorId);

    for (const { account, group } of matches) {
      const message = `Validator ${account.name} has been slashed. Details: ${await this.getEventLink(
        blockHash,
        eventRecord.phase
      )}`;
      const incidentKey = `${account.ss58}:${group.name}:handleSlashReported`;
      await this.incidentHandler.handleOneTimeIncident(
        incidentKey,
        message,
        group.alerts,
        blockNumber
      );
    }
  }
}
