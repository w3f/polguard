import { ApiPromise } from '@polkadot/api';
import { ApiDecoration } from '@polkadot/api/types';
import { Data, Struct } from '@polkadot/types';
import type { Option, Vec } from '@polkadot/types-codec';
import type { Codec } from '@polkadot/types-codec/types';
import type { H160 } from '@polkadot/types/interfaces';
import type { PalletAssetsAssetAccount } from '@polkadot/types/lookup';
import { CHAIN_TOKENS, Chain, TokenBalances } from '@w3f/monitoring-types';
import { AccountInfo } from '@polkadot/types/interfaces/system';

import { ChainDataProvider, KeyValueStorageClient, IdentityInfo, Logger } from '@w3f/monitoring-types';
import { createCachedQueryDecorator } from './decorators';

/**
 * Creates a chain data provider that implements chain queries with caching layer.
 * Uses multi-query for batch processing and includes proper error handling.
 *
 * @param api - Polkadot API instance
 * @param client - Key-value storage client for caching
 * @param logger - Logger instance
 * @returns DataProvider
 */
export function createChainDataProvider(api: ApiPromise, client: KeyValueStorageClient, logger: Logger, chain: Chain) {
  const Cached = createCachedQueryDecorator(client);

  class DataProvider implements ChainDataProvider {
    private apiAtBlock: Map<number, ApiDecoration<'promise'>> = new Map();

    constructor(
      public api: ApiPromise,
      public logger: Logger,
      public chain: Chain,
    ) {}

    initializeBlock(blockNumber: number, apiAt: ApiDecoration<'promise'>): void {
      this.apiAtBlock.clear();
      this.apiAtBlock.set(blockNumber, apiAt);
    }

    private async getApiAt(blockNumber: number): Promise<ApiDecoration<'promise'>> {
      const apiAt = this.apiAtBlock.get(blockNumber);
      if (apiAt) {
        return apiAt;
      }

      this.logger.debug('DataProvider cold start. Should happen only once.');
      const hash = await this.api.rpc.chain.getBlockHash(blockNumber);
      const apiAtBlock = await this.api.at(hash);
      this.apiAtBlock.set(blockNumber, apiAtBlock);
      return apiAtBlock;
    }

    /**
     * Helper method to work around ValueQuery behavior in stakingValidatorsCommission.
     * Since staking.validators uses ValueQuery, it returns default value (0) for non-existent keys.
     * This method gets all existing keys to distinguish between:
     * - Validators that don't exist (not in storage)
     * - Validators that exist with 0 commission (in storage with value 0)
     *
     * TODO: This seems suboptimal, find out better ways of dealing with ValueQuery storage
     */
    @Cached()
    async stakingValidators(blockNumber: number): Promise<string[]> {
      const apiAt = await this.getApiAt(blockNumber);
      const keys = await apiAt.query.staking.validators.keys();
      return keys.map(k => k.args[0].toString());
    }

    @Cached()
    async stakingValidatorsCommission(
      addresses: string[],
      blockNumber: number,
    ): Promise<Record<string, number | null>> {
      const apiAt = await this.getApiAt(blockNumber);
      const validatorAddresses = new Set(await this.stakingValidators(blockNumber));
      const prefs = await apiAt.query.staking.validators.multi(addresses);
      const result: Record<string, number | null> = {};

      addresses.forEach((address, index) => {
        if (!validatorAddresses.has(address)) {
          result[address] = null;
        } else {
          result[address] = prefs[index].commission.toNumber() / 10_000_000;
        }
      });

      return result;
    }

    @Cached()
    async stakingBonded(addresses: string[], blockNumber: number): Promise<Record<string, string | null>> {
      const apiAt = await this.getApiAt(blockNumber);
      const bondedInfo = await apiAt.query.staking.bonded.multi(addresses);
      const result: Record<string, string | null> = {};

      addresses.forEach((address, index) => {
        const info = bondedInfo[index] as Option<Codec>;
        const bondedAddress = info.isSome ? info.unwrap().toString() : null;
        result[address] = bondedAddress;
      });

      return result;
    }

    @Cached()
    async stakingLedgerActive(addresses: string[], blockNumber: number): Promise<Record<string, bigint | null>> {
      const apiAt = await this.getApiAt(blockNumber);
      const ledgers = await apiAt.query.staking.ledger.multi(addresses);
      const result: Record<string, bigint | null> = {};

      addresses.forEach((address, index) => {
        const ledger = ledgers[index];
        if (ledger.isNone) {
          result[address] = null;
        } else {
          result[address] = ledgers[index].unwrap().active.toBigInt();
        }
      });

      return result;
    }

    @Cached()
    async stakingPayee(addresses: string[], blockNumber: number): Promise<Record<string, string | null>> {
      const apiAt = await this.getApiAt(blockNumber);
      const payees = await apiAt.query.staking.payee.multi(addresses);
      const result: Record<string, string | null> = {};

      addresses.forEach((address, index) => {
        const payee = payees[index];
        if (payee.isNone) {
          result[address] = null;
        } else {
          const destination = payee.unwrap();
          if (destination.isAccount) {
            result[address] = destination.asAccount.toString();
          } else {
            result[address] = destination.toString();
          }
        }
      });

      return result;
    }

    @Cached()
    async stakingActiveEra(blockNumber: number): Promise<number> {
      const apiAt = await this.getApiAt(blockNumber);
      const activeEra = await apiAt.query.staking.activeEra();
      return activeEra.unwrapOrDefault().index.toNumber();
    }

    @Cached()
    async stakingEraValidators(era: number, blockNumber: number): Promise<Record<string, boolean>> {
      const apiAt = await this.getApiAt(blockNumber);
      const keys = await apiAt.query.staking.erasStakersOverview.keys(era);
      const result: Record<string, boolean> = {};

      keys.forEach(key => {
        const validator = key.args[1].toString();
        result[validator] = true;
      });

      return result;
    }

    @Cached()
    async sessionValidators(blockNumber: number): Promise<Record<string, boolean>> {
      const apiAt = await this.getApiAt(blockNumber);
      const validators = (await apiAt.query.session.validators()) as Vec<Codec>;
      const result: Record<string, boolean> = {};

      validators.forEach(validator => {
        result[validator.toString()] = true;
      });

      return result;
    }

    @Cached()
    async systemAccountBalance(addresses: string[], blockNumber: number): Promise<Record<string, bigint>> {
      const apiAt = await this.getApiAt(blockNumber);
      const accounts = await apiAt.query.system.account.multi(addresses);
      const result: Record<string, bigint> = {};

      addresses.forEach((address, index) => {
        const account = accounts[index] as unknown as AccountInfo;
        result[address] = account.data.free.toBigInt();
      });

      return result;
    }

    @Cached()
    async identityOf(addresses: string[], blockNumber: number): Promise<Record<string, IdentityInfo | null>> {
      const apiAt = await this.getApiAt(blockNumber);
      const identities = await apiAt.query.identity.identityOf.multi(addresses);
      const result: Record<string, IdentityInfo | null> = {};

      addresses.forEach((address, index) => {
        const identity = identities[index] as Option<Codec>;
        if (identity.isNone) {
          result[address] = null;
        } else {
          const identityOf = identity.unwrap();
          const id = Array.isArray(identityOf) ? identityOf[0] : identityOf;
          const identityInfo = this.processIdentityInfo(id.info as unknown as PeopleIdentityInfo);
          result[address] = identityInfo;
        }
      });

      return result;
    }

    @Cached()
    async identitySuperOf(addresses: string[], blockNumber: number): Promise<Record<string, string | null>> {
      const apiAt = await this.getApiAt(blockNumber);
      const result: Record<string, string | null> = {};

      const superIds = await apiAt.query.identity.superOf.multi(addresses);

      addresses.forEach((address, index) => {
        const identity = superIds[index] as Option<Codec>;
        if (identity.isNone) {
          result[address] = null;
        } else {
          const superOf = identity.unwrap();
          const id = Array.isArray(superOf) ? superOf[0] : superOf;
          result[address] = id.toString();
        }
      });

      return result;
    }

    processIdentityInfo(info: PeopleIdentityInfo): IdentityInfo {
      const fields = ['display', 'legal', 'web', 'matrix', 'email', 'image', 'twitter', 'github', 'discord'] as const;

      return fields.reduce((result, field) => {
        result[field] = this.extractDataString(info[field]);
        return result;
      }, {} as IdentityInfo);
    }

    extractDataString(data: Data): string | undefined {
      if (!data || data.isNone) {
        return undefined;
      } else if (data.isRaw) {
        return data.asRaw.toUtf8();
      } else if (data.isSha256) {
        return data.asSha256.toHex();
      }
      return undefined;
    }

    @Cached()
    async assetsAccountBalance(addresses: string[], tokenNames: string[], blockNumber: number): Promise<TokenBalances> {
      const apiAt = await this.getApiAt(blockNumber);
      const result: TokenBalances = {};

      for (const tokenName of tokenNames) {
        result[tokenName] = {};
        const assetId = CHAIN_TOKENS[this.chain][tokenName].id;
        const keys = addresses.map(address => [assetId, address]);
        const assetAccounts = await apiAt.query.assets.account.multi(keys);

        addresses.forEach((address, index) => {
          const assetAccount = assetAccounts[index] as Option<PalletAssetsAssetAccount>;
          if (assetAccount.isNone) {
            result[tokenName][address] = BigInt(0);
          } else {
            result[tokenName][address] = assetAccount.unwrap().balance.toBigInt();
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
      const apiAt = await this.getApiAt(blockNumber);
      const result: TokenBalances = {};

      for (const tokenName of tokenNames) {
        result[tokenName] = {};
        const currencyId = CHAIN_TOKENS[this.chain][tokenName].id;
        const keys = addresses.map(address => [address, JSON.parse(currencyId)]);
        const tokenAccounts = await apiAt.query.ormlTokens.accounts.multi(keys);

        addresses.forEach((address, idx) => {
          const acct = tokenAccounts[idx] as Struct & { free: Data };
          result[tokenName][address] = BigInt(acct.free.toString());
        });
      }

      return result;
    }

    @Cached()
    async referendaInfoFor(referendumIndex: string | number, blockNumber: number): Promise<string | null> {
      const apiAt = await this.getApiAt(blockNumber);
      const info = await apiAt.query.referenda.referendumInfoFor(referendumIndex);
      if (info.isNone) {
        return null;
      }

      const unwrapped = info.unwrap();
      if (!unwrapped.isOngoing) {
        return null;
      }

      return unwrapped.asOngoing.submissionDeposit.who.toString();
    }

    @Cached()
    async referendaTrack(trackId: number | string, blockNumber: number): Promise<string> {
      const apiAt = await this.getApiAt(blockNumber);

      const rawTracks = apiAt.consts.referenda.tracks as any;
      const idToFind = typeof trackId === 'string' ? parseInt(trackId, 10) : trackId;

      for (const entry of rawTracks as Array<[Codec, any]>) {
        const [idCodec, info] = entry;
        const id = (idCodec as any).toNumber();
        if (id === idToFind) {
          return info.name.toString();
        }
      }

      return `#${idToFind}`;
    }
  }

  return new DataProvider(api, logger, chain);
}

/**
 * @description
 * `PeopleIdentityInfo` is a custom type based on the legacy `PalletIdentityLegacyIdentityInfo`.
 * Recent changes in the Polkadot runtime removed hardcoded fields for identity info,
 * but this type is introduced to provide a representation for processing identity data
 * retrieved via `api.query.identity.identityOf`.
 * https://github.com/polkadot-js/api/blob/eab2f76884076ce045b641552e4f1db7ceee4e8a/packages/api-derive/src/accounts/identity.ts#L20
 *
 * This is not an on-chain type, that's why polkadot.js doesn't expose it.
 */
interface PeopleIdentityInfo extends Struct {
  display: Data;
  legal: Data;
  web: Data;
  matrix: Data;
  email: Data;
  pgpFingerprint: Option<H160>;
  image: Data;
  twitter: Data;
  github: Data;
  discord: Data;
}
