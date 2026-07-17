import {
  AssetsHandlerType as H,
  MonitorType,
  Chain,
  EventHandlerParams,
  ID_TOKEN_MAP,
  TokenBalances,
} from '../../types';
import { Event, State } from '../decorators';
import { AbstractMonitor } from './abstract-monitor';

type GetBalances = (addresses: string[], tokens: string[], block: number) => Promise<TokenBalances>;

export class AssetsMonitor extends AbstractMonitor<MonitorType.Assets> {
  @State(H.AssetBalanceDecreaseState, [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async assetBalanceDecrease(): Promise<void> {
    return this.handleBalanceDecrease((addrs, tokens, block) => this.chain.assetsAccountBalance(addrs, tokens, block));
  }

  @State(H.AssetBalanceDecreaseState, [Chain.Centrifuge])
  async ormlTokensBalanceDecrease(): Promise<void> {
    return this.handleBalanceDecrease((addrs, tokens, block) => this.chain.ormlTokensAccountBalance(addrs, tokens, block));
  }

  @State(H.AssetBalanceThresholdState, [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async assetBalanceThreshold(): Promise<void> {
    return this.handleBalanceThreshold((addrs, tokens, block) => this.chain.assetsAccountBalance(addrs, tokens, block));
  }

  @State(H.AssetBalanceThresholdState, [Chain.Centrifuge])
  async ormlTokensBalanceThreshold(): Promise<void> {
    return this.handleBalanceThreshold((addrs, tokens, block) => this.chain.ormlTokensAccountBalance(addrs, tokens, block));
  }

  @Event(
    H.AssetTransferIngressEvent,
    [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo],
    'assets.Transferred',
  )
  @Event(H.AssetTransferIngressEvent, [Chain.Centrifuge], 'ormlTokens.Transfer')
  async onTransferIngress({ payload }: EventHandlerParams<H.AssetTransferIngressEvent>): Promise<void> {
    const tokenId = String(payload.asset_id || payload.currency_id);
    const { from, to, amount } = payload;
    const token = ID_TOKEN_MAP[this.chainProps.chain][tokenId];

    for (const a of this.matched(to)) {
      if (!a.settings.tokens?.includes(token)) continue;
      await a.report(`Received ${this.balance(amount, token)}`, [`From: ${this.accountRef(from)}`], token);
    }
  }

  @Event(
    H.AssetTransferEgressEvent,
    [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo],
    'assets.Transferred',
  )
  @Event(H.AssetTransferEgressEvent, [Chain.Centrifuge], 'ormlTokens.Transfer')
  async onTransferEgress({ payload }: EventHandlerParams<H.AssetTransferEgressEvent>): Promise<void> {
    const tokenId = String(payload.asset_id || payload.currency_id);
    const { from, to, amount } = payload;
    const token = ID_TOKEN_MAP[this.chainProps.chain][tokenId];

    for (const a of this.matched(from)) {
      if (!a.settings.tokens?.includes(token)) continue;
      await a.report(`Sent ${this.balance(amount, token)}`, [`To: ${this.accountRef(to)}`], token);
    }
  }

  /**
   * Common handler for balance decrease monitoring that works with any token source
   */
  private async handleBalanceDecrease(getBalances: GetBalances): Promise<void> {
    const { blockNumber } = this.block;
    const addresses = this.reg.getUniqueAddresses();
    const tokens = this.reg.getUniqueTokens();
    if (tokens.length === 0) return;

    const [curr, prev] = await Promise.all([
      getBalances(addresses, tokens, blockNumber),
      getBalances(addresses, tokens, blockNumber - 1),
    ]);

    for (const a of this.watched()) {
      if (!a.settings.tokens) continue;
      for (const token of a.settings.tokens) {
        const currentBalance = curr[token][a.ss58];
        const previousBalance = prev[token][a.ss58];
        if (currentBalance < previousBalance) {
          await a.report(
            'Balance decreased',
            [`Previous: ${this.balance(previousBalance, token)}`, `Current: ${this.balance(currentBalance, token)}`],
            token,
          );
        }
      }
    }
  }

  /**
   * Common handler for balance threshold monitoring that works with any token source
   */
  private async handleBalanceThreshold(getBalances: GetBalances): Promise<void> {
    const addresses = this.reg.getUniqueAddresses();
    const tokens = this.reg.getUniqueTokens();
    if (tokens.length === 0) return;

    const cur = await getBalances(addresses, tokens, this.block.blockNumber);

    for (const a of this.watched()) {
      if (!a.settings.tokenThresholds) continue;
      for (const [token, threshold] of a.settings.tokenThresholds) {
        const currentBalance = cur[token][a.ss58];
        if (currentBalance < threshold) {
          await a.track(
            'Balance below threshold',
            [`Threshold: ${this.balance(threshold, token)}`, `Balance: ${this.balance(currentBalance, token)}`],
            true,
            token,
          );
        }
      }
    }
  }
}
