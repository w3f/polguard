import { EventRecord } from '@polkadot/types/interfaces/system';
import { BlockHash } from '@polkadot/types/interfaces';
import { AbstractMonitor } from '../abstract-monitor';
import { EventHandler } from '../decorators';

export class GovernanceMonitor extends AbstractMonitor {

  @EventHandler('referenda.Submitted')
  async handleReferendaSubmitted(eventRecord: EventRecord, blockHash: BlockHash, blockNumber: number): Promise<void> {
    // TODO: Do we need persistence?
  }

  @EventHandler('convictionVoting.Voted')
  async handleConvictionVoted(eventRecord: EventRecord, blockHash: BlockHash, blockNumber: number): Promise<void> {
    // TODO: polkadot-sdk currently doesn't have referenda id in the event. PR/issue to polkadot-sdk is required.
    // Current Event: Voted { who: T::AccountId, vote: AccountVote<BalanceOf<T, I>> },
  }
  
}
