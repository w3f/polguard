import { ApiPromise } from '@polkadot/api';
import { Data, Struct } from '@polkadot/types';
import type { Option } from '@polkadot/types-codec';
import type { H160 } from '@polkadot/types/interfaces';
import { StateQueryProvider, KeyValueStorageClient, IdentityInfo, Logger } from '@w3f/monitoring-types';
import { createCachedQueryDecorator } from '../decorators';

export function createApiStateQueryProvider(api: ApiPromise, client: KeyValueStorageClient, logger: Logger) {
  const Cached = createCachedQueryDecorator(client);

  class ApiStateQueryProvider implements StateQueryProvider {
    constructor(
      public api: ApiPromise,
      public logger: Logger,
    ) {}

    @Cached()
    async stakingValidatorsComission(addresses: string[], blockNumber: number): Promise<Record<string, number | null>> {
      const apiAt = await this.api.at(await this.api.rpc.chain.getBlockHash(blockNumber));
      const prefs = await apiAt.query.staking.validators.multi(addresses);
      const result: Record<string, number | null> = {};

      addresses.forEach((address, index) => {
        if (prefs[index].isEmpty) {
          this.logger.warn(`Account ${address} has no validator preferences set but is configured for monitoring.`);
          result[address] = null;
        } else {
          result[address] = prefs[index].commission.toNumber() / 10_000_000;
        }
      });

      return result;
    }

    @Cached()
    async stakingBonded(addresses: string[], blockNumber: number): Promise<Record<string, string | null>> {
      const apiAt = await this.api.at(await this.api.rpc.chain.getBlockHash(blockNumber));
      const controllers = await apiAt.query.staking.bonded.multi(addresses);
      const result: Record<string, string | null> = {};

      addresses.forEach((address, index) => {
        const controller = controllers[index].isSome ? controllers[index].unwrap().toString() : null;

        if (!controller) {
          this.logger.warn(`No controller found for validator ${address} at block ${blockNumber}`);
        }
        result[address] = controller;
      });

      return result;
    }

    @Cached()
    async stakingLedgerActive(addresses: string[], blockNumber: number): Promise<Record<string, bigint | null>> {
      const apiAt = await this.api.at(await this.api.rpc.chain.getBlockHash(blockNumber));
      const ledgers = await apiAt.query.staking.ledger.multi(addresses);
      const result: Record<string, bigint | null> = {};

      addresses.forEach((address, index) => {
        if (ledgers[index].isNone) {
          this.logger.warn(`No staking ledger found for controller ${address} at block ${blockNumber}`);
          result[address] = null;
        } else {
          result[address] = ledgers[index].unwrap().active.toBigInt();
        }
      });

      return result;
    }

    @Cached()
    async stakingPayee(addresses: string[], blockNumber: number): Promise<Record<string, string | null>> {
      const apiAt = await this.api.at(await this.api.rpc.chain.getBlockHash(blockNumber));
      const payees = await apiAt.query.staking.payee.multi(addresses);
      const result: Record<string, string | null> = {};

      addresses.forEach((address, index) => {
        const payee = payees[index];
        if (payee.isEmpty) {
          this.logger.warn(
            `Account ${address} has no payee set (not bonded for staking) ` +
              `at block ${blockNumber} but is configured for monitoring.`,
          );
          result[address] = null;
        } else {
          result[address] = payee.toString();
        }
      });

      return result;
    }

    @Cached()
    async stakingActiveEra(blockNumber: number): Promise<number> {
      const apiAt = await this.api.at(await this.api.rpc.chain.getBlockHash(blockNumber));
      const activeEra = await apiAt.query.staking.activeEra();
      return activeEra.unwrapOrDefault().index.toNumber();
    }

    @Cached()
    async sessionValidators(blockNumber: number): Promise<Record<string, boolean>> {
      const apiAt = await this.api.at(await this.api.rpc.chain.getBlockHash(blockNumber));
      const validators = await apiAt.query.session.validators();
      const result: Record<string, boolean> = {};

      validators.forEach(validator => {
        result[validator.toString()] = true;
      });

      return result;
    }

    @Cached()
    async systemAccountBalance(addresses: string[], blockNumber: number): Promise<Record<string, bigint>> {
      const apiAt = await this.api.at(await this.api.rpc.chain.getBlockHash(blockNumber));
      const accounts = await apiAt.query.system.account.multi(addresses);
      const result: Record<string, bigint> = {};

      addresses.forEach((address, index) => {
        result[address] = accounts[index].data.free.toBigInt();
      });

      return result;
    }

    @Cached()
    async identityOf(addresses: string[], blockNumber: number): Promise<Record<string, IdentityInfo | null>> {
      const apiAt = await this.api.at(await this.api.rpc.chain.getBlockHash(blockNumber));
      const identities = await apiAt.query.identity.identityOf.multi(addresses);
      const result: Record<string, IdentityInfo | null> = {};

      addresses.forEach((address, index) => {
        const identity = identities[index];
        if (identity.isNone) {
          this.logger.warn(`No identity found for address ${address} at block ${blockNumber}`);
          result[address] = null;
        } else {
          result[address] = this.processIdentityInfo(identity.unwrap()[0].info as unknown as PeopleIdentityInfo);
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
  }

  return new ApiStateQueryProvider(api, logger);
}

/**
 * @description
 * `PeopleIdentityInfo` is a custom type based on the legacy `PalletIdentityLegacyIdentityInfo`.
 * Recent changes in the Polkadot runtime removed hardcoded fields for identity info,
 * but this type is introduced to provide a representation for processing identity data
 * retrieved via `api.query.identity.identityOf`.
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
