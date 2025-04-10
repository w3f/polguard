import { MonitorType, EventHandlerParams, Chain, GovernanceHandlerType as H } from '@w3f/monitoring-types';
import { AbstractChainMonitor } from '../abstract-chain-monitor';
import { Event, IncidentPayload } from '../../../common/decorators';

export class GovernanceMonitor extends AbstractChainMonitor<MonitorType.Governance> {
  @Event(H.ReferendaSubmitted, [Chain.Polkadot, Chain.Kusama], 'referenda.Submitted')
  async referendaSubmitted({}: EventHandlerParams<H.ReferendaSubmitted>): Promise<IncidentPayload[]> {
    // TODO: Do we need persistence?
    return [];
  }

  @Event(H.ConvictionVoted, [Chain.Polkadot, Chain.Kusama], 'convictionVoting.Voted')
  async convictionVoted({}: EventHandlerParams<H.ConvictionVoted>): Promise<IncidentPayload[]> {
    // TODO: polkadot-sdk currently doesn't have referenda id in the event. PR/issue to polkadot-sdk is required.
    // Current Event: Voted { who: T::AccountId, vote: AccountVote<BalanceOf<T, I>> },
    return [];
  }
}
