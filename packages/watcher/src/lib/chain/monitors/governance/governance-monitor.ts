import { MonitorType, EventHandlerParams, Chain, GovernanceHandlerType as H } from '@w3f/monitoring-types';
import { AbstractChainMonitor } from '../abstract-chain-monitor';
import { Event, Handler } from '../../../common/decorators';

export class GovernanceMonitor extends AbstractChainMonitor<MonitorType.Governance> {
  @Event('referenda.Submitted', [Chain.Polkadot, Chain.Kusama])
  @Handler(H.ReferendaSubmitted)
  async referendaSubmitted({}: EventHandlerParams<H>): Promise<void> {
    // TODO: Do we need persistence?
  }

  @Event('convictionVoting.Voted', [Chain.Polkadot, Chain.Kusama])
  @Handler(H.ConvictionVoted)
  async convictionVoted({}: EventHandlerParams<H>): Promise<void> {
    // TODO: polkadot-sdk currently doesn't have referenda id in the event. PR/issue to polkadot-sdk is required.
    // Current Event: Voted { who: T::AccountId, vote: AccountVote<BalanceOf<T, I>> },
  }
}
