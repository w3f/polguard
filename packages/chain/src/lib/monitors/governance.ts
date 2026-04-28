import type { AccountVote } from '@polkadot/types/interfaces';
import { MonitorType, Chain, GovernanceHandlerType as H, EventHandlerParams, CallHandlerParams } from '../../types';
import { AbstractMonitor } from './abstract-monitor';
import { Call, Event } from '../decorators';

export class GovernanceMonitor extends AbstractMonitor<MonitorType.Governance> {
  private getGovernanceChainSlug(): string {
    switch (this.chainProps.chain) {
      case Chain.AssetHubKusama:
        return 'kusama';
      case Chain.AssetHubPolkadot:
        return 'polkadot';
      case Chain.AssetHubPaseo:
        return 'paseo';
      default:
        return this.chainProps.chain.toLowerCase();
    }
  }

  @Event(
    H.ReferendaSubmittedEvent,
    [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo],
    'referenda.Submitted',
  )
  async referendaSubmitted({
    payload,
    blockContext,
    handlerType,
  }: EventHandlerParams<H.ReferendaSubmittedEvent>): Promise<void> {
    const { blockNumber } = blockContext;
    const { index, track } = payload;
    const proposer = (await this.chain.referendaInfoFor(index, blockNumber)) ?? 'unknown';
    const chainSlug = this.getGovernanceChainSlug();
    const subsquareLink = this.fmt.link('Subsquare', `https://${chainSlug}.subsquare.io/referenda/${index}`);
    const polkassemblyLink = this.fmt.link(
      'Polkassembly',
      `https://${chainSlug}.polkassembly.io/referenda/${index}`,
    );
    // Sanitize C-style string
    const trackName = (await this.chain.referendaTrack(track)).replace(/\0/g, '');
    const message = this.fmt.message(
      [
        `Referendum #${index} submitted`,
        `Proposed by: ${this.fmt.accountLink(proposer, proposer)}`,
        `Track: ${trackName}`,
        `Links: ${subsquareLink} | ${polkassemblyLink}`,
      ],
      blockContext,
    );
    for (const { groupId, notifications } of this.reg.getGroupsByHandler(handlerType)) {
      const key = { account: 'None', groupId, handlerType };
      await this.incidents.handle(message, notifications, key, blockContext);
    }
  }

  @Call(
    H.ConvictionVoteCall,
    [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo],
    'convictionVoting.vote',
  )
  async convictionVote({
    call,
    origin,
    blockContext,
    handlerType,
  }: CallHandlerParams<H.ConvictionVoteCall>): Promise<void> {
    const pollIndex = call.args[0].toString();
    const voteArg = call.args[1] as AccountVote;

    let voteLines: string[];
    if (voteArg.isStandard) {
      const { vote, balance } = voteArg.asStandard;
      const direction = vote.isAye ? 'Aye' : 'Nay';
      voteLines = [`Direction: ${direction}`, `Amount: ${this.fmt.balance(balance.toString())}`];
    } else if (voteArg.isSplit) {
      const { aye, nay } = voteArg.asSplit;
      voteLines = [`Aye: ${this.fmt.balance(aye.toString())}`, `Nay: ${this.fmt.balance(nay.toString())}`];
    } else {
      voteLines = ['(Unknown vote format)'];
    }

    for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, origin)) {
      const message = this.fmt.message(
        [`${this.fmt.accountLink(account.name, account.ss58)} cast a vote on referendum #${pollIndex}`, ...voteLines],
        blockContext,
      );
      const key = { account: account.ss58, groupId, handlerType };
      await this.incidents.handle(message, notifications, key, blockContext);
    }
  }
}
