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
    const polkassemblyLink = this.fmt.link('Polkassembly', `https://${chainSlug}.polkassembly.io/referenda/${index}`);
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
    'ConvictionVoting.vote',
  )
  async convictionVote({
    call,
    origin,
    blockContext,
    handlerType,
  }: CallHandlerParams<H.ConvictionVoteCall>): Promise<void> {
    const args = call.value.value;
    const pollIndex = String(args.poll_index);
    const voteArg = args.vote;
    let voteLines: string[];
    // { type: "Standard", value: { vote: number, balance: bigint } }
    if (voteArg?.type === 'Standard') {
      const { vote, balance } = voteArg.value;
      // vote is a compact vote byte: bit 7 = aye, bits 0-6 = conviction
      const direction = typeof vote === 'number' ? (vote & 0x80 ? 'Aye' : 'Nay') : String(vote);
      voteLines = [`Direction: ${direction}`, `Amount: ${this.fmt.balance(String(balance))}`];
      // { type: "Split", value: { aye: bigint, nay: bigint } }
    } else if (voteArg?.type === 'Split') {
      const { aye, nay } = voteArg.value;
      voteLines = [`Aye: ${this.fmt.balance(String(aye))}`, `Nay: ${this.fmt.balance(String(nay))}`];
      //{ type: "SplitAbstain", value: { aye: bigint, nay: bigint, abstain: bigint } }
    } else if (voteArg?.type === 'SplitAbstain') {
      const { aye, nay, abstain } = voteArg.value;
      voteLines = [
        `Aye: ${this.fmt.balance(String(aye))}`,
        `Nay: ${this.fmt.balance(String(nay))}`,
        `Abstain: ${this.fmt.balance(String(abstain))}`,
      ];
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
