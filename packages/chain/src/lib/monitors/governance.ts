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
  async referendaSubmitted({ payload }: EventHandlerParams<H.ReferendaSubmittedEvent>): Promise<void> {
    const { index, track } = payload;
    const proposer = await this.chain.referendaInfoFor(index, this.block.blockNumber);
    const chainSlug = this.getGovernanceChainSlug();
    const subsquareLink = `[Subsquare](https://${chainSlug}.subsquare.io/referenda/${index})`;
    const polkassemblyLink = `[Polkassembly](https://${chainSlug}.polkassembly.io/referenda/${index})`;
    // Sanitize C-style string
    const trackName = (await this.chain.referendaTrack(track)).replace(/\0/g, '');

    // Account-less handler bypasses the bound-account API (matched/watched) by design.
    const content = {
      condition: `Referendum #${index} submitted`,
      details: [
        proposer ? `Proposed by: ${this.accountRef(proposer)}` : false,
        `Track: ${trackName}`,
        `Links: ${subsquareLink} | ${polkassemblyLink}`,
      ].filter(Boolean) as string[],
    };
    for (const { groupId, notifications } of this.reg.getGroupsByHandler(this.handlerType)) {
      const key = { account: 'None', groupId, handlerType: this.handlerType };
      await this.incidents.handle(content, notifications, key, this.block);
    }
  }

  @Call(
    H.ConvictionVoteCall,
    [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo],
    'ConvictionVoting.vote',
  )
  async convictionVote({ call, origin }: CallHandlerParams<H.ConvictionVoteCall>): Promise<void> {
    const args = call.value.value;
    const pollIndex = String(args.poll_index);
    const voteArg = args.vote;
    let voteLines: string[];
    // { type: "Standard", value: { vote: number, balance: bigint } }
    if (voteArg?.type === 'Standard') {
      const { vote, balance } = voteArg.value;
      // vote is a compact vote byte: bit 7 = aye, bits 0-6 = conviction
      const direction = typeof vote === 'number' ? (vote & 0x80 ? 'Aye' : 'Nay') : String(vote);
      voteLines = [`Direction: ${direction}`, `Amount: ${this.balance(String(balance))}`];
      // { type: "Split", value: { aye: bigint, nay: bigint } }
    } else if (voteArg?.type === 'Split') {
      const { aye, nay } = voteArg.value;
      voteLines = [`Aye: ${this.balance(String(aye))}`, `Nay: ${this.balance(String(nay))}`];
      //{ type: "SplitAbstain", value: { aye: bigint, nay: bigint, abstain: bigint } }
    } else if (voteArg?.type === 'SplitAbstain') {
      const { aye, nay, abstain } = voteArg.value;
      voteLines = [
        `Aye: ${this.balance(String(aye))}`,
        `Nay: ${this.balance(String(nay))}`,
        `Abstain: ${this.balance(String(abstain))}`,
      ];
    } else {
      voteLines = ['(Unknown vote format)'];
    }

    for (const a of this.matched(origin)) await a.report(`Voted on referendum #${pollIndex}`, voteLines);
  }
}
