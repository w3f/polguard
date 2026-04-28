import {
  AssetsHandlerType as H,
  MonitorType,
  Chain,
  EventHandlerParams,
  StateHandlerParams,
  ID_TOKEN_MAP,
  TokenBalances,
} from '../../types';
import { Event, State } from '../decorators';
import { AbstractMonitor } from './abstract-monitor';

export class AssetsMonitor extends AbstractMonitor<MonitorType.Assets> {
  @State(H.AssetBalanceDecreaseState, [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async assetBalanceDecrease(params: StateHandlerParams<H.AssetBalanceDecreaseState>): Promise<void> {
    return this.handleBalanceDecrease(
      (addrs, tokens, block) => this.chain.assetsAccountBalance(addrs, tokens, block),
      params,
    );
  }

  @State(H.AssetBalanceDecreaseState, [Chain.Centrifuge])
  async ormlTokensBalanceDecrease(params: StateHandlerParams<H.AssetBalanceDecreaseState>): Promise<void> {
    return this.handleBalanceDecrease(
      (addrs, tokens, block) => this.chain.ormlTokensAccountBalance(addrs, tokens, block),
      params,
    );
  }

  @State(H.AssetBalanceThresholdState, [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async assetBalanceThreshold(params: StateHandlerParams<H.AssetBalanceThresholdState>): Promise<void> {
    return this.handleBalanceThreshold(
      (addrs, tokens, block) => this.chain.assetsAccountBalance(addrs, tokens, block),
      params,
    );
  }

  @State(H.AssetBalanceThresholdState, [Chain.Centrifuge])
  async ormlTokensBalanceThreshold(params: StateHandlerParams<H.AssetBalanceThresholdState>): Promise<void> {
    return this.handleBalanceThreshold(
      (addrs, tokens, block) => this.chain.ormlTokensAccountBalance(addrs, tokens, block),
      params,
    );
  }

  @Event(
    H.AssetTransferIngressEvent,
    [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo],
    'assets.Transferred',
  )
  @Event(H.AssetTransferIngressEvent, [Chain.Centrifuge], 'ormlTokens.Transfer')
  async onTransferIngress({
    payload,
    blockContext,
    handlerType,
  }: EventHandlerParams<H.AssetTransferIngressEvent>): Promise<void> {
    const tokenId = String(payload.asset_id || payload.currency_id);
    const { from, to, amount } = payload;
    const token = ID_TOKEN_MAP[this.chainProps.chain][tokenId];

    for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, to)) {
      if (!account.settings.tokens?.includes(token)) continue;

      const message = this.fmt.message(
        [
          `${this.fmt.accountLink(account.name, account.ss58)} received ${this.fmt.balance(amount, token)}`,
          `From: ${this.fmt.accountLink(from, from)}`,
        ],
        blockContext,
      );

      const key = { account: account.ss58, groupId, handlerType, token };
      await this.incidents.handle(message, notifications, key, blockContext);
    }
  }

  @Event(
    H.AssetTransferEgressEvent,
    [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo],
    'assets.Transferred',
  )
  @Event(H.AssetTransferEgressEvent, [Chain.Centrifuge], 'ormlTokens.Transfer')
  async onTransferEgress({
    payload,
    blockContext,
    handlerType,
  }: EventHandlerParams<H.AssetTransferEgressEvent>): Promise<void> {
    const tokenId = String(payload.asset_id || payload.currency_id);
    const { from, to, amount } = payload;
    const token = ID_TOKEN_MAP[this.chainProps.chain][tokenId];

    for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, from)) {
      if (!account.settings.tokens?.includes(token)) continue;

      const message = this.fmt.message(
        [
          `${this.fmt.accountLink(account.name, account.ss58)} sent ${this.fmt.balance(amount, token)}`,
          `To: ${this.fmt.accountLink(to, to)}`,
        ],
        blockContext,
      );

      const key = { account: account.ss58, groupId, handlerType, token };
      await this.incidents.handle(message, notifications, key, blockContext);
    }
  }

  /**
   * Common handler for balance decrease monitoring that works with any token source
   */
  private async handleBalanceDecrease(
    getBalances: (addresses: string[], tokens: string[], block: number) => Promise<TokenBalances>,
    params: StateHandlerParams<H.AssetBalanceDecreaseState>,
  ): Promise<void> {
    const { blockContext, handlerType } = params;
    const { blockNumber } = blockContext;
    const addresses = this.reg.getUniqueAddresses();
    const tokens = this.reg.getUniqueTokens();
    if (tokens.length === 0) return;

    const [curr, prev] = await Promise.all([
      getBalances(addresses, tokens, blockNumber),
      getBalances(addresses, tokens, blockNumber - 1),
    ]);

    for (const address of addresses) {
      for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, address)) {
        if (!account.settings.tokens) continue;
        for (const token of account.settings.tokens) {
          const currentBalance = curr[token][address];
          const previousBalance = prev[token][address];
          if (currentBalance < previousBalance) {
            const msg = this.fmt.message(
              [
                `Balance decreased for ${this.fmt.accountLink(account.name, account.ss58)}`,
                `Previous: ${this.fmt.balance(previousBalance, token)}`,
                `Current:  ${this.fmt.balance(currentBalance, token)}`,
              ],
              blockContext,
            );
            const key = { account: account.ss58, groupId, handlerType, token };
            await this.incidents.handle(msg, notifications, key, blockContext);
          }
        }
      }
    }
  }

  /**
   * Common handler for balance threshold monitoring that works with any token source
   */
  private async handleBalanceThreshold(
    getBalances: (addresses: string[], tokens: string[], block: number) => Promise<TokenBalances>,
    params: StateHandlerParams<H.AssetBalanceThresholdState>,
  ): Promise<void> {
    const { blockContext, handlerType } = params;
    const { blockNumber } = blockContext;
    const addresses = this.reg.getUniqueAddresses();
    const tokens = this.reg.getUniqueTokens();
    if (tokens.length === 0) return;

    const cur = await getBalances(addresses, tokens, blockNumber);

    for (const address of addresses) {
      for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, address)) {
        if (!account.settings.tokenThresholds) continue;

        for (const [token, threshold] of account.settings.tokenThresholds) {
          const currentBalance = cur[token][address];
          if (currentBalance < threshold) {
            const message = this.fmt.message(
              [
                `Balance for ${this.fmt.accountLink(account.name, account.ss58)} is below threshold`,
                `Current balance: ${this.fmt.balance(currentBalance, token)}`,
                `Threshold: ${this.fmt.balance(threshold, token)}`,
              ],
              blockContext,
            );

            const key = { account: account.ss58, groupId, handlerType, token };
            await this.incidents.handle(message, notifications, key, blockContext, true);
          }
        }
      }
    }
  }
}
