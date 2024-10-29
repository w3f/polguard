import { AbstractMonitor } from '../abstract-monitor';
import { EventHandler } from '../decorators';
import { EventHandlerParams } from '@lib/interfaces';

export class GovernanceMonitor extends AbstractMonitor {

  @EventHandler('referenda.Submitted')
  async handleReferendaSubmitted({ eventRecord, blockHash, blockNumber }: EventHandlerParams): Promise<void> {
    // TODO: Do we need persistence?
  }

  @EventHandler('convictionVoting.Voted')
  async handleConvictionVoted({ eventRecord, blockHash, blockNumber }: EventHandlerParams): Promise<void> {
    // TODO: polkadot-sdk currently doesn't have referenda id in the event. PR/issue to polkadot-sdk is required.
    // Current Event: Voted { who: T::AccountId, vote: AccountVote<BalanceOf<T, I>> },
  }
  
}
