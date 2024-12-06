import '@polkadot/api-augment/polkadot';
import { EveryBlockHandler, EventHandler } from '../../decorators';
import { PalletStakingRewardDestination, PalletStakingValidatorPrefs } from '@polkadot/types/lookup';
import { EveryBlockHandlerParams, CallHandlerParams, EventHandlerParams } from '../../interfaces';
import { AbstractMonitor } from '../abstract-monitor';
import { ComparisonType, MonitorType } from '@lib/constants';

export class ValidatorMonitor extends AbstractMonitor<MonitorType.Validator> {
  @EventHandler('staking.SlashReported')
  async handleSlashReported({ eventRecord, blockNumber }: EventHandlerParams): Promise<void> {
    const validatorId = eventRecord.event.data[0].toString();
    for (const { account, alerts } of this.getAccounts(validatorId)) {
      const message = this.createMessage([`Validator ${account.name} has been slashed.`], {
        blockNumber,
        phase: eventRecord.phase,
      });

      await this.incidents.oneTimeIncident(message, alerts, blockNumber);
    }
  }

  // TODO: Granular control over handlers.
  // Temporary commented out "Change" handlers (with unit tests)

  // @EventHandler('staking.ValidatorPrefsSet')
  async handleCommissionChanged({ eventRecord, blockNumber }: EventHandlerParams): Promise<void> {
    const stash = eventRecord.event.data[0].toString();
    const prefs = eventRecord.event.data[1] as PalletStakingValidatorPrefs;
    for (const { account, alerts } of this.getAccounts(stash)) {
      const message = this.createMessage(
        [`New commission change detected for ${account.name}.`, `Commission: ${prefs.commission}`],
        { blockNumber, phase: eventRecord.phase },
      );

      await this.incidents.oneTimeIncident(message, alerts, blockNumber);
    }
  }

  // @CallHandler(['staking.setPayee', 'staking.bond'])
  async handleDestinationChanged({ call, origin, blockNumber, extrinsicIndex }: CallHandlerParams): Promise<void> {
    const payee = (call.method === 'setPayee' ? call.args[0] : call.args[1]) as PalletStakingRewardDestination;
    for (const { account, alerts } of this.getAccounts(origin)) {
      const message = this.createMessage(
        [`New destination change detected for ${account.name}.`, `Destination: ${this.getDestinationString(payee)}`],
        { blockNumber, extrinsicIndex },
      );

      await this.incidents.oneTimeIncident(message, alerts, blockNumber);
    }
  }

  // TODO: Add Event handler (payout claimed), it should require expectedDestination != current.
  @EveryBlockHandler()
  async handleCommissionUnexpected({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const commissions = await this.stateQuery.validatorCommissions(this.uniqueAddresses, blockNumber);
    if (commissions === null) {
      return;
    }
    for (let i = 0; i < this.uniqueAddresses.length; i++) {
      const address = this.uniqueAddresses[i];
      const commission = commissions[address];
      for (const { account, alerts, groupId } of this.getAccounts(address)) {
        const expectedCommission = account.settings.commission;
        const comparisonType = account.settings.commissionComparison;
        const compareFunction = ValidatorMonitor.comparisonFunctions[comparisonType];
        const isFiring = !compareFunction(commission, expectedCommission);
  
        const message = this.createMessage(
          [
            `Unexpected commission detected for ${account.name}.`,
            `Actual commission: ${commission}`,
            `Expected commission: ${expectedCommission}`,
            `Comparison type: ${ComparisonType[comparisonType]}`,
          ],
          { address: account.ss58, blockNumber },
        );

        const key = `${account.ss58}:${groupId}:handleCommissionUnexpected`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }

  @EveryBlockHandler()
  async handleDestinationUnexpected({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const payees = await this.stateQuery.payees(this.uniqueAddresses, blockNumber);
    for (let i = 0; i < this.uniqueAddresses.length; i++) {
      const address = this.uniqueAddresses[i];
      const destination = payees[address] ? this.getDestinationString(payees[address]) : 'None';
      for (const { account, alerts, groupId } of this.accounts.get(address) || []) {
        const expectedDestination = account.settings.payee;

        if (!expectedDestination) continue;
        const isFiring = destination !== expectedDestination;

        const message = this.createMessage(
          [
            `Unexpected reward destination detected for ${account.name}.`,
            `Actual destination: ${destination}`,
            `Expected destination: ${expectedDestination}`,
          ],
          { address: account.ss58, blockNumber },
        );

        const key = `${account.ss58}:${groupId}:handleDestinationUnexpected`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }

  @EveryBlockHandler()
  async handleActiveSetPresense({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const validators = await this.stateQuery.validators(blockNumber);
    for (const acc of this.uniqueAddresses) {
      for (const { account, alerts, groupId } of this.getAccounts(acc)) {
        const isFiring = !validators[account.ss58];

        const message = this.createMessage([
          `Target ${account.name} is not present in the validation active set.`,
          `Era: ${await this.stateQuery.era(blockNumber)}`,
        ]);

        const key = `${account.ss58}:${groupId}:handleValidatorActiveSetPresense`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }

  protected getDestinationString(destination: PalletStakingRewardDestination): string {
    if (destination.isAccount) {
      return destination.asAccount.toString();
    }
    return destination.type;
  }
}
