import { MonitorType, EventHandlerParams, Chain, GovernanceHandlerType as H } from '@w3f/monitoring-types';
import { AbstractMonitor } from './abstract-monitor';
import { Event } from '../decorators';

export class GovernanceMonitor extends AbstractMonitor<MonitorType.Governance> {
  @Event(H.ReferendaSubmitted, [Chain.Polkadot, Chain.Kusama], 'referenda.Submitted')
  async referendaSubmitted({}: EventHandlerParams<H.ReferendaSubmitted>): Promise<void> {
    // TODO: Do we need persistence?
  }

  @Event(H.ConvictionVoted, [Chain.Polkadot, Chain.Kusama], 'convictionVoting.Voted')
  async convictionVoted({}: EventHandlerParams<H.ConvictionVoted>): Promise<void> {
    // TODO: polkadot-sdk currently doesn't have referenda id in the event. PR/issue to polkadot-sdk is required.
    // Current Event: Voted { who: T::AccountId, vote: AccountVote<BalanceOf<T, I>> },
  }
}
