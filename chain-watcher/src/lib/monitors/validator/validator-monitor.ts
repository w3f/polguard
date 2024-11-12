import '@polkadot/api-augment/polkadot';
import { Option } from '@polkadot/types';
import { EveryBlockHandler, CallHandler, EventHandler } from '../decorators';
import { AbstractValidatorMonitor } from './abstract-validator-monitor';
import { PalletStakingRewardDestination, PalletStakingValidatorPrefs } from '@polkadot/types/lookup';
import { EveryBlockHandlerParams, CallHandlerParams, EventHandlerParams } from '../../interfaces';

export class ValidatorMonitor extends AbstractValidatorMonitor {
  @EventHandler('session.NewSession')
  async handleNewEra({}: EventHandlerParams): Promise<void> {
    await this.updateCurrentEra();
    await this.updateCurrentEraValidators();
  }

  @EventHandler('staking.SlashReported')
  async handleSlashReported({ eventRecord, blockNumber }: EventHandlerParams): Promise<void> {
    const validatorId = eventRecord.event.data[0].toString();
    for (const { account, alerts } of this.getAccounts(validatorId)) {
      const message = this.createMessage([
        `Validator ${account.name} has been slashed.`,
        `Details: ${this.getEventLink(blockNumber, eventRecord.phase)}`,
      ]);

      await this.incidents.oneTimeIncident(message, alerts, blockNumber);
    }
  }

  @EventHandler('staking.ValidatorPrefsSet')
  async handleCommissionChanged({ eventRecord, blockNumber }: EventHandlerParams): Promise<void> {
    const stash = eventRecord.event.data[0].toString();
    const prefs = eventRecord.event.data[1] as PalletStakingValidatorPrefs;
    for (const { account, alerts } of this.getAccounts(stash)) {
      const message = this.createMessage([
        `New commission change detected for ${account.name}.`,
        `Commission: ${prefs.commission}`,
        `Details: ${this.getEventLink(blockNumber, eventRecord.phase)}`,
      ]);

      await this.incidents.oneTimeIncident(message, alerts, blockNumber);
    }
  }

  @CallHandler(['staking.setPayee', 'staking.bond'])
  async handleDestinationChanged({ call, origin, blockHash, blockNumber }: CallHandlerParams): Promise<void> {
    const payee = (call.method === 'setPayee' ? call.args[0] : call.args[1]) as PalletStakingRewardDestination;
    for (const { account, alerts } of this.getAccounts(origin)) {
      const message = this.createMessage([
        `New destination change detected for ${account.name}.`,
        `Destination: ${this.getDestinationString(payee)}`,
        `Details: ${await this.getExtrinsicLink(blockHash, call)}`,
      ]);

      await this.incidents.oneTimeIncident(message, alerts, blockNumber);
    }
  }

  // TODO: Add Event handler (payout claimed), it should require expectedDestination != current.
  @EveryBlockHandler()
  async handleCommissionUnexpected({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const results = await this.api.queryMulti<PalletStakingValidatorPrefs[]>(
      this.uniqueAddresses.map(address => [this.api.query.staking.validators, address]),
    );
    for (let i = 0; i < this.uniqueAddresses.length; i++) {
      const address = this.uniqueAddresses[i];
      const prefs = results[i];
      const commission = prefs.commission.toNumber() / 10000000;
      for (const { account, alerts, groupId } of this.getAccounts(address)) {
        const expectedCommission = account.settings.commission;
        const isFiring = commission !== expectedCommission;

        const message = this.createMessage([
          `Commission change detected for ${account.name}.`,
          `Actual commission: ${commission}`,
          `Expected commission: ${expectedCommission}`,
          `Details: ${this.getAccountLink(account.ss58)}`,
        ]);

        const key = `${account.ss58}:${groupId}:handleCommissionUnexpected`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }

  @EveryBlockHandler()
  async handleDestinationUnexpected({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const results = await this.api.queryMulti<Option<PalletStakingRewardDestination>[]>(
      this.uniqueAddresses.map(address => [this.api.query.staking.payee, address]),
    );
    for (let i = 0; i < this.uniqueAddresses.length; i++) {
      const address = this.uniqueAddresses[i];
      const payeeOption = results[i];
      const destination = payeeOption.isSome ? this.getDestinationString(payeeOption.unwrap()) : 'None';
      for (const { account, alerts, groupId } of this.accounts.get(address) || []) {
        const expectedDestination = account.settings.payee;

        // Skip if there's no expected payee configured
        if (!expectedDestination) continue;
        const isFiring = destination !== expectedDestination;

        const message = this.createMessage([
          `Reward destination change detected for ${account.name}.`,
          `Actual destination: ${destination}`,
          `Expected destination: ${expectedDestination}`,
          `Details: ${this.getAccountLink(account.ss58)}`,
        ]);

        const key = `${account.ss58}:${groupId}:handleDestinationUnexpected`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }

  @EveryBlockHandler()
  async handleActiveSetPresense({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const validators = await this.getCurrentEraValidators();
    for (const acc of this.uniqueAddresses) {
      for (const { account, alerts, groupId } of this.getAccounts(acc)) {
        const isFiring = !validators.has(account.ss58);

        const message = this.createMessage([
          `Target ${account.name} is not present in the validation active set.`,
          `Era: ${this.currentEra}`,
        ]);

        const key = `${account.ss58}:${groupId}:handleValidatorActiveSetPresense`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }
}
