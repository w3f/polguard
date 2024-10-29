import { ApiPromise } from '@polkadot/api';
import { Option } from '@polkadot/types';
import { ActiveEraInfo } from '@polkadot/types/interfaces/staking';
import { Vec } from '@polkadot/types/codec';
import { AccountId } from '@polkadot/types/interfaces/runtime';
import { PalletStakingRewardDestination } from '@polkadot/types/lookup';
import { Logger, MonitoringGroup } from '../../interfaces';
import { IncidentHandler } from '../../incident/incident-handler';
import { ChainWatcherStore } from '../../store/chain-watcher-store';
import { AbstractMonitor } from '../abstract-monitor';

export abstract class AbstractValidatorMonitor extends AbstractMonitor {
  protected currentEra: number | null = null;
  private currentValidators: Set<string> | null = null;

  constructor(
    logger: Logger,
    api: ApiPromise,
    groups: MonitoringGroup[],
    incidentHandler: IncidentHandler,
    store: ChainWatcherStore,
  ) {
    super(logger, api, groups, incidentHandler, store);
    this.initializeValidatorMonitor();
  }

  private async initializeValidatorMonitor(): Promise<void> {
    await this.updateCurrentEra();
    await this.updateCurrentEraValidators();
  }

  protected async updateCurrentEra(): Promise<void> {
    const activeEra: Option<ActiveEraInfo> = await this.api.query.staking.activeEra();
    this.currentEra = activeEra.unwrap().index.toNumber();
    await this.store.setCurrentEra(this.currentEra);
  }

  protected async updateCurrentEraValidators(): Promise<void> {
    this.currentValidators = await this.getCurrentEraValidators();
  }

  protected async getCurrentEraValidators(): Promise<Set<string>> {
    if (this.currentEra === null) {
      await this.updateCurrentEra();
    }
    let validators = await this.store.getEraValidators(this.currentEra);

    if (!validators) {
      const validatorSet: Vec<AccountId> = await this.api.query.session.validators();
      validators = new Set(
        validatorSet.map((validator) => validator.toString())
      );
      await this.store.setEraValidators(this.currentEra, validators);
    }

    return validators;
  }

  protected getDestinationString(destination: PalletStakingRewardDestination): string {
    if (destination.isAccount) {
      return destination.asAccount.toString();
    }
    return destination.type;
  }
}
