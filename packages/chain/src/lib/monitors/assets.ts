import {
  Chain,
  StateHandlerParams,
  MonitorType,
  AssetsHandlerType as H,
  EventHandlerParams,
  ID_TOKEN_MAP,
  TokenBalances,
} from '@w3f/monitoring-types';
import { Event, State } from '../decorators';
import { AbstractMonitor } from './abstract-monitor';

export class AssetsMonitor extends AbstractMonitor<MonitorType.Assets> {
  @State(H.AssetBalanceDecrease, [Chain.AssetHubPolkadot, Chain.AssetHubKusama])
  async assetBalanceDecrease(params: StateHandlerParams<H.AssetBalanceDecrease>): Promise<void> {
    return this.handleBalanceDecrease(
      (addrs, tokens, block) => this.chain.assetsAccountBalance(addrs, tokens, block),
      params,
    );
  }

  @State(H.AssetBalanceDecrease, [Chain.Centrifuge])
  async ormlTokensBalanceDecrease(params: StateHandlerParams<H.AssetBalanceDecrease>): Promise<void> {
    return this.handleBalanceDecrease(
      (addrs, tokens, block) => this.chain.ormlTokensAccountBalance(addrs, tokens, block),
      params,
    );
  }

  @State(H.AssetBalanceThreshold, [Chain.AssetHubPolkadot, Chain.AssetHubKusama])
  async assetBalanceThreshold(params: StateHandlerParams<H.AssetBalanceThreshold>): Promise<void> {
    return this.handleBalanceThreshold(
      (addrs, tokens, block) => this.chain.assetsAccountBalance(addrs, tokens, block),
      params,
    );
  }

  @State(H.AssetBalanceThreshold, [Chain.Centrifuge])
  async ormlTokensBalanceThreshold(params: StateHandlerParams<H.AssetBalanceThreshold>): Promise<void> {
    return this.handleBalanceThreshold(
      (addrs, tokens, block) => this.chain.ormlTokensAccountBalance(addrs, tokens, block),
      params,
    );
  }

  @Event(H.AssetTransferIngress, [Chain.AssetHubPolkadot, Chain.AssetHubKusama], 'assets.Transferred')
  @Event(H.AssetTransferIngress, [Chain.Centrifuge], 'ormlTokens.Transfer')
  async onTransferIngress({
    eventRecord,
    blockNumber,
    handlerType,
  }: EventHandlerParams<H.AssetTransferIngress>): Promise<void> {
    const [rawId, from, to, amount] = eventRecord.event.data.map(d => d.toString());
    console.log(rawId);
    const token = ID_TOKEN_MAP[this.chainProps.chain][rawId];
    console.log(token);

    for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, to)) {
      if (!account.settings.tokens?.includes(token)) continue;

      const message = this.fmt.message(
        [
          `${this.fmt.accountLink(account)} received ${this.fmt.assetBalance(amount, token)}`,
          `From: ${this.fmt.accountLink({ ss58: from, name: from, hex: '' })}`,
        ],
        { blockNumber, phase: eventRecord.phase },
      );

      const key = { account: account.ss58, groupId, handlerType, token };
      await this.incidents.handle(message, notifications, key, blockNumber);
    }
  }

  @Event(H.AssetTransferEgress, [Chain.AssetHubPolkadot, Chain.AssetHubKusama], 'assets.Transferred')
  @Event(H.AssetTransferEgress, [Chain.Centrifuge], 'ormlTokens.Transfer')
  async onTransferEgress({
    eventRecord,
    blockNumber,
    handlerType,
  }: EventHandlerParams<H.AssetTransferEgress>): Promise<void> {
    const [rawId, from, to, amount] = eventRecord.event.data.map(d => d.toString());
    const token = ID_TOKEN_MAP[this.chainProps.chain][rawId];

    for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, from)) {
      if (!account.settings.tokens?.includes(token)) continue;

      const message = this.fmt.message(
        [
          `${this.fmt.accountLink(account)} sent ${this.fmt.assetBalance(amount, token)}`,
          `To: ${this.fmt.accountLink({ ss58: to, name: to, hex: '' })}`,
        ],
        { blockNumber, phase: eventRecord.phase },
      );

      const key = { account: account.ss58, groupId, handlerType, token };
      await this.incidents.handle(message, notifications, key, blockNumber);
    }
  }

  /**
   * Common handler for balance decrease monitoring that works with any token source
   */
  private async handleBalanceDecrease(
    getBalances: (addresses: string[], tokens: string[], block: number) => Promise<TokenBalances>,
    params: StateHandlerParams<H.AssetBalanceDecrease>,
  ): Promise<void> {
    const { blockNumber, handlerType } = params;
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
                `${token} balance decreased for ${this.fmt.accountLink(account)}`,
                `Previous: ${this.fmt.assetBalance(previousBalance, token)}`,
                `Current:  ${this.fmt.assetBalance(currentBalance, token)}`,
              ],
              { blockNumber },
            );
            const key = { account: account.ss58, groupId, handlerType, token };
            await this.incidents.handle(msg, notifications, key, blockNumber);
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
    params: StateHandlerParams<H.AssetBalanceThreshold>,
  ): Promise<void> {
    const { blockNumber, handlerType } = params;
    const addresses = this.reg.getUniqueAddresses();
    const tokens = this.reg.getUniqueTokens();
    if (tokens.length === 0) return;

    const cur = await getBalances(addresses, tokens, blockNumber);

    for (const address of addresses) {
      for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, address)) {
        if (!account.settings.tokenThresholds) continue;

        for (const [token, threshold] of account.settings.tokenThresholds) {
          const currentBalance = cur[token][address];
          if (currentBalance === null) continue;

          if (currentBalance < threshold) {
            const message = this.fmt.message(
              [
                `${token} balance for ${this.fmt.accountLink(account)} is below threshold.`,
                `Current balance: ${this.fmt.assetBalance(currentBalance, token)}`,
                `Threshold: ${this.fmt.assetBalance(threshold, token)}`,
              ],
              { blockNumber },
            );

            const key = { account: account.ss58, groupId, handlerType, token };
            await this.incidents.handle(message, notifications, key, blockNumber, true);
          }
        }
      }
    }
  }
}
