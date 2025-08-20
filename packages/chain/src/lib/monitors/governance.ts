import type { AccountVote } from '@polkadot/types/interfaces';
import {
  MonitorType,
  EventHandlerParams,
  Chain,
  GovernanceHandlerType as H,
  CallHandlerParams,
} from '@w3f/monitoring-types';
import { AbstractMonitor } from './abstract-monitor';
import { Call, Event } from '../decorators';

export class GovernanceMonitor extends AbstractMonitor<MonitorType.Governance> {
  @Event(H.ReferendaSubmittedEvent, [Chain.Polkadot, Chain.Kusama], 'referenda.Submitted')
  async referendaSubmitted({
    eventRecord,
    blockContext,
    handlerType,
  }: EventHandlerParams<H.ReferendaSubmittedEvent>): Promise<void> {
    const { blockNumber } = blockContext;
    const [referendumIndex, trackId] = eventRecord.event.data.map(arg => arg.toString());
    const proposer = (await this.chain.referendaInfoFor(referendumIndex, blockNumber)) ?? 'unknown';
    const subsquareLink = this.fmt.link(
      'Subsquare',
      `https://${this.chainProps.chain.toLowerCase()}.subsquare.io/referenda/${referendumIndex}`,
    );
    const polkassemblyLink = this.fmt.link(
      'Polkassembly',
      `https://${this.chainProps.chain.toLowerCase()}.polkassembly.io/referenda/${referendumIndex}`,
    );
    // Sanitize C-style string
    const trackName = (await this.chain.referendaTrack(trackId, blockNumber)).replace(/\0/g, '');
    const message = this.fmt.message(
      [
        `Referendum #${referendumIndex} submitted`,
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

  @Call(H.ConvictionVoteCall, [Chain.Polkadot, Chain.Kusama], 'convictionVoting.vote')
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
