import { ApiPromise } from '@polkadot/api';
import { PalletStakingRewardDestination } from '@polkadot/types/lookup';
import { StateQueryProvider, KeyValueStorageClient } from '@w3f/monitoring-types';
import { createCachedQueryDecorator } from '../decorators';

export function createApiStateQueryProvider(api: ApiPromise, client: KeyValueStorageClient) {
  const Cached = createCachedQueryDecorator(client);

  class ApiStateQueryProvider implements StateQueryProvider {
    constructor(public api: ApiPromise) {}

    @Cached()
    async validatorCommissions(addresses: string[], blockNumber: number): Promise<Record<string, number>> {
      const apiAt = await this.api.at(await this.api.rpc.chain.getBlockHash(blockNumber));
      const prefs = await apiAt.query.staking.validators.multi(addresses);
      const result: Record<string, number> = {};
      addresses.forEach((address, index) => {
        result[address] = prefs[index].commission.toNumber() / 10_000_000;
      });
      return result;
    }

    @Cached()
    async payees(addresses: string[], blockNumber: number): Promise<Record<string, PalletStakingRewardDestination>> {
      const apiAt = await this.api.at(await this.api.rpc.chain.getBlockHash(blockNumber));
      const payeeOptions = await apiAt.query.staking.payee.multi(addresses);
      const result: Record<string, PalletStakingRewardDestination> = {};
      addresses.forEach((address, index) => {
        result[address] = payeeOptions[index].unwrapOr(null);
      });
      return result;
    }

    @Cached()
    async validators(blockNumber: number): Promise<Record<string, boolean>> {
      // TODO: Optimisation. Getting validators for every block is suboptimal.
      // Validator set changes once per era:
      // https://github.com/paritytech/polkadot-sdk/blob/8d4138f77106a6af49920ad84f3283f696f3f905/substrate/frame/session/src/lib.rs#L654
      const apiAt = await this.api.at(await this.api.rpc.chain.getBlockHash(blockNumber));
      const validatorSet = await apiAt.query.session.validators();

      const result: Record<string, boolean> = {};
      validatorSet.forEach(validator => {
        result[validator.toString()] = true;
      });
      return result;
    }

    @Cached()
    async era(blockNumber: number): Promise<number> {
      const apiAt = await this.api.at(await this.api.rpc.chain.getBlockHash(blockNumber));
      const activeEra = await apiAt.query.staking.activeEra();
      return activeEra.unwrapOrDefault().index.toNumber();
    }

    @Cached()
    async balances(addresses: string[], blockNumber: number): Promise<Record<string, bigint>> {
      const apiAt = await this.api.at(await this.api.rpc.chain.getBlockHash(blockNumber));
      const accountInfos = await apiAt.query.system.account.multi(addresses);
      const result: Record<string, bigint> = {};
      addresses.forEach((address, index) => {
        result[address] = accountInfos[index].data.free.toBigInt();
      });
      return result;
    }
  }

  return new ApiStateQueryProvider(api);
}
