import '@polkadot/api-augment/polkadot';
import { Option } from '@polkadot/types';
import { BlockHandler, CallHandler, EventHandler } from '../decorators';
import { AbstractValidatorMonitor } from './abstract-validator-monitor';
import { PalletStakingPalletEvent, PalletStakingRewardDestination, PalletStakingValidatorPrefs } from '@polkadot/types/lookup';
import { BlockHandlerParams, CallHandlerParams, EventHandlerParams, ValidatorSettings } from '../../interfaces';
import { MonitorType } from '../../constants';
import { registry } from '../../chain-watcher';

export class ValidatorMonitor extends AbstractValidatorMonitor {
  
  @EventHandler('session.NewSession')
  async handleNewEra({ blockHash, blockNumber }: BlockHandlerParams): Promise<void> {
    await this.updateCurrentEra();
    await this.updateCurrentEraValidators();
  }
  
  @EventHandler('staking.SlashReported')
  async handleSlashReported({ eventRecord, blockHash, blockNumber }: EventHandlerParams): Promise<void> {
    const validatorId = eventRecord.event.data[0].toString();
    for (const { account, group } of this.getGroups(validatorId)) {
      const message = this.formatMessage(
        `Validator ${account.name} has been slashed.`,
        [`Details: ${await this.getEventLink(blockNumber, eventRecord.phase)}`]
      );
      await this.incidents.oneTimeIncident(message, group.alerts, blockNumber);
    }
  }
  
  @EventHandler('staking.ValidatorPrefsSet')
  async handleCommissionChanged({ eventRecord, blockHash, blockNumber }: EventHandlerParams): Promise<void> {
    const [stashRaw, prefsRaw] = eventRecord.event.data;
    const stash = stashRaw.toString();
    const prefs = registry.createType('PalletStakingValidatorPrefs', prefsRaw.toU8a());
    for (const { account, group } of this.getGroups(stash)) {
      const message = this.formatMessage(
        `New commission change detected for ${account.name}.`,
        [
          `New commission: ${prefs.commission}`,
          `Event details: ${await this.getEventLink(blockNumber, eventRecord.phase)}`
        ]
      );
      await this.incidents.oneTimeIncident(message, group.alerts, blockNumber);
    }
  }

  @CallHandler(['staking.setPayee', 'staking.bond'])
  async handleDestinationChanged({ call, origin, blockHash, blockNumber }: CallHandlerParams): Promise<void> {
    const payee = (call.method === 'setPayee' ? call.args[0] : call.args[1]) as PalletStakingRewardDestination;
    for (const { account, group } of this.getGroups(origin)) {
      const message = this.formatMessage(
        `New destination change detected for ${account.name}.`,
        [
          `New destination: ${this.getDestinationString(payee)}`,
          `Extrinsic details: ${await this.getExtrinsicLink(blockHash, call)}`
        ]
      );
      await this.incidents.oneTimeIncident(message, group.alerts, blockNumber);
    }
  }
  

  @BlockHandler()
  async handleCommissionUnexpected({ blockHash, blockNumber }: BlockHandlerParams): Promise<void> {
    const results = await this.api.queryMulti<Option<PalletStakingValidatorPrefs>[]>(
      this.accounts.map(account => [this.api.query.staking.validators, account])
    );
    for (let i = 0; i < this.accounts.length; i++) {
      for (const { account, group } of this.getGroups(this.accounts[i])) {
        const settings: ValidatorSettings = account[MonitorType.Validator];
        const currentCommission = results[i].isSome ? results[i].unwrap() : -1;
        const expectedCommission = settings.commission;
        const isFiring = currentCommission !== expectedCommission;
        const message = this.formatMessage(
          `New commission change detected for ${account.name}.`,
          [
            `New commission: ${currentCommission}`,
            `Expected commission: ${expectedCommission}`,
            `Account details: ${this.getAccountLink(account.ss58)}`
          ]
        );
        const key = `${account.ss58}:${group.name}:handleCommissionUnexpected`;
        await this.incidents.ongoingIncident(message, group.alerts, blockNumber, key, isFiring);
      }
    }
  }
  
  @BlockHandler()
  async handleDestinationUnexpected({ blockHash, blockNumber }: BlockHandlerParams): Promise<void> {
    const results = await this.api.queryMulti<Option<PalletStakingRewardDestination>[]>(
      this.accounts.map(account => [this.api.query.staking.payee, account])
    );
    for (let i = 0; i < this.accounts.length; i++) {
      for (const { account, group } of this.getGroups(this.accounts[i])) {
        const settings: ValidatorSettings = account[MonitorType.Validator];
        const currentDestination = results[i].isSome ? this.getDestinationString(results[i].unwrap()) : 'None';
        const expectedDestination = settings.payee;
        const isFiring = currentDestination !== expectedDestination;
        const message = this.formatMessage(
          `New destination change detected for ${account.name}.`,
          [
            `New destination: ${currentDestination}`,
            `Expected destination: ${expectedDestination}`,
            `Account details: ${this.getAccountLink(account.ss58)}`
          ]
        );
        const key = `${account.ss58}:${group.name}:handleDestinationUnexpected`;
        await this.incidents.ongoingIncident(message, group.alerts, blockNumber, key, isFiring);
      }
    }
  }
  
  @BlockHandler()
  async handleActiveSetPresense({ blockHash, blockNumber }: BlockHandlerParams): Promise<void> {
    const validators = await this.getCurrentEraValidators();
    for (const acc of this.accounts) {
      for (const { account, group } of this.getGroups(acc)) {
        const isFiring = !validators.has(account.ss58);
        const message = this.formatMessage(
          `Target ${account.name} is not present in the validation active set.`,
          [`Era: ${this.currentEra}`]
        );
        const key = `${account.ss58}:${group.name}:handleValidatorActiveSetPresense`;
        await this.incidents.ongoingIncident(message, group.alerts, blockNumber, key, isFiring);
      }
    }
  }
  
}
