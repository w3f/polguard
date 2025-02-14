import { MonitorType, EventHandlerParams, Chain } from '@w3f/monitoring-types';
import { AbstractChainMonitor } from '../abstract-chain-monitor';
import { EventHandler } from '../../../common/decorators';

export class GovernanceMonitor extends AbstractChainMonitor<MonitorType.Governance> {
  @EventHandler('referenda.Submitted', [Chain.Polkadot, Chain.Kusama])
  async referendaSubmitted({}: EventHandlerParams): Promise<void> {
    // TODO: Do we need persistence?
  }

  @EventHandler('convictionVoting.Voted', [Chain.Polkadot, Chain.Kusama])
  async convictionVoted({}: EventHandlerParams): Promise<void> {
    // TODO: polkadot-sdk currently doesn't have referenda id in the event. PR/issue to polkadot-sdk is required.
    // Current Event: Voted { who: T::AccountId, vote: AccountVote<BalanceOf<T, I>> },
  }
}
