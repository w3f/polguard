import { PolkadotClient } from 'polkadot-api';
import { Logger, Chain, ChainDataProvider, Store, IdentityInfo, TokenBalances, CHAIN_TOKENS } from '../types';
import { createCachedQueryDecorator } from './decorators';
import { getTypedApi } from './papi-descriptors';

/**
 * Creates a chain data provider that implements chain queries with caching layer.
 */
export function createChainDataProvider(client: PolkadotClient, store: Store, logger: Logger, chain: Chain) {
  const Cached = createCachedQueryDecorator(store);
  const typedApi = getTypedApi(client, chain);

  class DataProvider implements ChainDataProvider {
    private blockHashCache: Map<number, string> = new Map();

    constructor(
      private client: PolkadotClient,
      public logger: Logger,
      public chain: Chain,
    ) {}

    private async getBlockHash(blockNumber: number): Promise<string> {
      const cached = this.blockHashCache.get(blockNumber);
      if (cached) return cached;

      const hash = await this.client._request<string, [number]>('chain_getBlockHash', [blockNumber]);
      this.blockHashCache.set(blockNumber, hash);

      if (this.blockHashCache.size > 100) {
        const oldestKey = Math.min(...this.blockHashCache.keys());
        this.blockHashCache.delete(oldestKey);
      }

      return hash;
    }

    /**
     * Helper method to work around ValueQuery behavior in stakingValidatorsCommission.
     * Since staking.validators uses ValueQuery, it returns default value (0) for non-existent keys.
     * This method gets all existing keys to distinguish between:
     * - Validators that don't exist (not in storage)
     * - Validators that exist with 0 commission (in storage with value 0)
     */
    @Cached()
    async stakingValidators(blockNumber: number): Promise<string[]> {
      const blockHash = await this.getBlockHash(blockNumber);
      const entries = await typedApi.query.Staking.Validators.getEntries({ at: blockHash });
      return entries.map(e => e.keyArgs[0] as string);
    }

    @Cached()
    async stakingValidatorsCommission(
      addresses: string[],
      blockNumber: number,
    ): Promise<Record<string, number | null>> {
      const blockHash = await this.getBlockHash(blockNumber);
      const validatorAddresses = new Set(await this.stakingValidators(blockNumber));
      const prefs = await typedApi.query.Staking.Validators.getValues(
        addresses.map(addr => [addr]),
        { at: blockHash },
      );
      const result: Record<string, number | null> = {};

      addresses.forEach((address, index) => {
        if (!validatorAddresses.has(address)) {
          result[address] = null;
        } else {
          result[address] = (prefs[index] as any).commission / 10_000_000;
        }
      });

      return result;
    }

    @Cached()
    async stakingBonded(addresses: string[], blockNumber: number): Promise<Record<string, string | null>> {
      const blockHash = await this.getBlockHash(blockNumber);
      const bondedInfo = await typedApi.query.Staking.Bonded.getValues(
        addresses.map(addr => [addr]),
        { at: blockHash },
      );
      const result: Record<string, string | null> = {};

      addresses.forEach((address, index) => {
        const bondedAddress = bondedInfo[index];
        result[address] = bondedAddress !== undefined ? (bondedAddress as string) : null;
      });

      return result;
    }

    @Cached()
    async stakingLedgerActive(addresses: string[], blockNumber: number): Promise<Record<string, bigint | null>> {
      const blockHash = await this.getBlockHash(blockNumber);
      const ledgers = await typedApi.query.Staking.Ledger.getValues(
        addresses.map(addr => [addr]),
        { at: blockHash },
      );
      const result: Record<string, bigint | null> = {};

      addresses.forEach((address, index) => {
        const ledger = ledgers[index];
        result[address] = ledger !== undefined ? (ledger as any).active : null;
      });

      return result;
    }

    @Cached()
    async stakingPayee(addresses: string[], blockNumber: number): Promise<Record<string, string | null>> {
      const blockHash = await this.getBlockHash(blockNumber);
      const payees = await typedApi.query.Staking.Payee.getValues(
        addresses.map(addr => [addr]),
        { at: blockHash },
      );
      const result: Record<string, string | null> = {};

      addresses.forEach((address, index) => {
        const payee = payees[index] as any;
        if (payee === undefined) {
          result[address] = null;
        } else {
          if (payee.type === 'Account') {
            result[address] = payee.value;
          } else {
            result[address] = payee.type;
          }
        }
      });

      return result;
    }

    @Cached()
    async stakingActiveEra(blockNumber: number): Promise<number> {
      const blockHash = await this.getBlockHash(blockNumber);
      const activeEra = await typedApi.query.Staking.ActiveEra.getValue({ at: blockHash });
      return (activeEra as any)?.index ?? 0;
    }

    @Cached()
    async stakingEraValidators(era: number, blockNumber: number): Promise<Record<string, boolean>> {
      const blockHash = await this.getBlockHash(blockNumber);
      const entries = await typedApi.query.Staking.ErasStakersOverview.getEntries(era, { at: blockHash });
      const result: Record<string, boolean> = {};

      entries.forEach(entry => {
        const validator = entry.keyArgs[1] as string;
        result[validator] = true;
      });

      return result;
    }

    @Cached()
    async sessionValidators(blockNumber: number): Promise<Record<string, boolean>> {
      const blockHash = await this.getBlockHash(blockNumber);
      const validators = await typedApi.query.Session.Validators.getValue({ at: blockHash });
      const result: Record<string, boolean> = {};

      (validators as any).forEach((validator: string) => {
        result[validator] = true;
      });

      return result;
    }

    @Cached()
    async systemAccountBalance(addresses: string[], blockNumber: number): Promise<Record<string, bigint>> {
      const blockHash = await this.getBlockHash(blockNumber);
      const accounts = await typedApi.query.System.Account.getValues(
        addresses.map(addr => [addr]),
        { at: blockHash },
      );
      const result: Record<string, bigint> = {};

      addresses.forEach((address, index) => {
        result[address] = (accounts[index] as any).data.free;
      });

      return result;
    }

    @Cached()
    async identityOf(addresses: string[], blockNumber: number): Promise<Record<string, IdentityInfo | null>> {
      const blockHash = await this.getBlockHash(blockNumber);
      const identities = await typedApi.query.Identity.IdentityOf.getValues(
        addresses.map(addr => [addr]),
        { at: blockHash },
      );
      const result: Record<string, IdentityInfo | null> = {};

      addresses.forEach((address, index) => {
        const identity = identities[index];
        if (identity === undefined) {
          result[address] = null;
        } else {
          const id = Array.isArray(identity) ? identity[0] : identity;
          const identityInfo = this.processIdentityInfo((id as any).info);
          result[address] = identityInfo;
        }
      });

      return result;
    }

    @Cached()
    async identitySuperOf(addresses: string[], blockNumber: number): Promise<Record<string, string | null>> {
      const blockHash = await this.getBlockHash(blockNumber);
      const superIds = await typedApi.query.Identity.SuperOf.getValues(
        addresses.map(addr => [addr]),
        { at: blockHash },
      );
      const result: Record<string, string | null> = {};

      addresses.forEach((address, index) => {
        const identity = superIds[index];
        if (identity === undefined) {
          result[address] = null;
        } else {
          const id = Array.isArray(identity) ? identity[0] : identity;
          result[address] = id as string;
        }
      });

      return result;
    }

    processIdentityInfo(info: any): IdentityInfo {
      const fields = ['display', 'legal', 'web', 'matrix', 'email', 'image', 'twitter', 'github', 'discord'] as const;

      return fields.reduce((result, field) => {
        const value = info[field];
        if (value && (value.type === 'Raw' || value.type === 'Sha256')) {
          result[field] = value.value;
        }
        return result;
      }, {} as IdentityInfo);
    }

    @Cached()
    async assetsAccountBalance(addresses: string[], tokenNames: string[], blockNumber: number): Promise<TokenBalances> {
      const blockHash = await this.getBlockHash(blockNumber);
      const result: TokenBalances = {};

      for (const tokenName of tokenNames) {
        result[tokenName] = {};
        const assetId = CHAIN_TOKENS[this.chain][tokenName].id;
        const keys = addresses.map(address => [assetId, address]);
        const assetAccounts = await typedApi.query.Assets.Account.getValues(keys, { at: blockHash });

        addresses.forEach((address, index) => {
          const assetAccount = assetAccounts[index];
          if (assetAccount === undefined) {
            result[tokenName][address] = BigInt(0);
          } else {
            result[tokenName][address] = (assetAccount as any).balance;
          }
        });
      }
      return result;
    }

    @Cached()
    async ormlTokensAccountBalance(
      addresses: string[],
      tokenNames: string[],
      blockNumber: number,
    ): Promise<TokenBalances> {
      const blockHash = await this.getBlockHash(blockNumber);
      const result: TokenBalances = {};

      for (const tokenName of tokenNames) {
        result[tokenName] = {};
        const currencyId = CHAIN_TOKENS[this.chain][tokenName].id;
        const keys = addresses.map(address => [address, JSON.parse(currencyId)]);
        const tokenAccounts = await typedApi.query.OrmlTokens.Accounts.getValues(keys, { at: blockHash });

        addresses.forEach((address, idx) => {
          const acct = tokenAccounts[idx];
          result[tokenName][address] = (acct as any).free;
        });
      }

      return result;
    }

    @Cached()
    async referendaInfoFor(referendumIndex: string | number, blockNumber: number): Promise<string | null> {
      const blockHash = await this.getBlockHash(blockNumber);
      const info = await typedApi.query.Referenda.ReferendumInfoFor.getValue(referendumIndex, { at: blockHash });

      if (info === undefined) {
        return null;
      }

      const infoData = info as any;
      if (infoData.type !== 'Ongoing') {
        return null;
      }

      return infoData.value.submissionDeposit.who;
    }

    @Cached()
    async referendaTrack(trackId: number | string): Promise<string> {
      const tracks = await typedApi.constants.Referenda.Tracks();
      const idToFind = typeof trackId === 'string' ? parseInt(trackId, 10) : trackId;

      for (const [id, info] of tracks as any) {
        if (id === idToFind) {
          return info.name;
        }
      }

      return `#${idToFind}`;
    }
  }

  return new DataProvider(client, logger, chain);
}
