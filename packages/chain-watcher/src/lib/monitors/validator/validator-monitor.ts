import '@polkadot/api-augment/polkadot';
import { EveryBlockHandler, EventHandler, CallHandler } from '../../decorators';
import { PalletStakingRewardDestination, PalletStakingValidatorPrefs } from '@polkadot/types/lookup';
import {
  ValidatorHandlerType as H,
  EveryBlockHandlerParams,
  CallHandlerParams,
  EventHandlerParams,
  MonitorType,
  Chain,
} from '@w3f/monitoring-types';
import { AbstractMonitor } from '../abstract-monitor';

export class ValidatorMonitor extends AbstractMonitor<MonitorType.Validator> {
  @EventHandler('staking.SlashReported', [Chain.Polkadot, Chain.Kusama])
  async slashReported({ eventRecord, blockNumber }: EventHandlerParams): Promise<void> {
    const validatorId = eventRecord.event.data[0].toString();
    for (const { account, alerts } of this.getAccounts(H.SlashReported, validatorId)) {
      const message = this.createMessage([`Validator ${account.name} has been slashed.`], {
        blockNumber,
        phase: eventRecord.phase,
      });

      await this.incidents.oneTimeIncident(message, alerts, blockNumber);
    }
  }

  @EventHandler('staking.ValidatorPrefsSet', [Chain.Polkadot, Chain.Kusama])
  async commissionChanged({ eventRecord, blockNumber }: EventHandlerParams): Promise<void> {
    const stash = eventRecord.event.data[0].toString();
    const prefs = eventRecord.event.data[1] as PalletStakingValidatorPrefs;
    for (const { account, alerts } of this.getAccounts(H.CommissionChanged, stash)) {
      const message = this.createMessage(
        [`New commission change detected for ${this.formatAccountLink(account)}.`, `Commission: ${prefs.commission}`],
        { blockNumber, phase: eventRecord.phase },
      );

      await this.incidents.oneTimeIncident(message, alerts, blockNumber);
    }
  }

  @CallHandler(['staking.setPayee', 'staking.bond'], [Chain.Polkadot, Chain.Kusama])
  async destinationChanged({ call, origin, blockNumber, extrinsicIndex }: CallHandlerParams): Promise<void> {
    const payee = (call.method === 'setPayee' ? call.args[0] : call.args[1]) as PalletStakingRewardDestination;
    for (const { account, alerts } of this.getAccounts(H.DestinationChanged, origin)) {
      const message = this.createMessage(
        [
          `New destination change detected for ${this.formatAccountLink(account)}.`,
          `Destination: ${this.getDestinationString(payee)}`,
        ],
        { blockNumber, extrinsicIndex },
      );

      await this.incidents.oneTimeIncident(message, alerts, blockNumber);
    }
  }

  // TODO: Add Event handler (payout claimed), it should require expectedDestination != current.
  @EveryBlockHandler([Chain.Polkadot, Chain.Kusama])
  async commissionUnexpected({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const commissions = await this.stateQuery.validatorCommissions(this.uniqueAddresses, blockNumber);
    if (commissions === null) {
      return;
    }
    for (let i = 0; i < this.uniqueAddresses.length; i++) {
      const address = this.uniqueAddresses[i];
      const commission = commissions[address];
      for (const { account, alerts, groupId } of this.getAccounts(H.CommissionUnexpected, address)) {
        const expectedCommission = account.settings.commission;
        const comparisonType = account.settings.commissionComparison;
        const compareFunction = ValidatorMonitor.comparisonFunctions[comparisonType];
        const isFiring = !compareFunction(commission, expectedCommission);

        const message = this.createMessage(
          [
            `Unexpected commission detected for ${this.formatAccountLink(account)}.`,
            `Actual commission: ${commission}`,
            `Expected commission: ${expectedCommission}`,
          ],
          { blockNumber },
        );

        const key = `${account.ss58}:${groupId}:handleCommissionUnexpected`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }

  @EveryBlockHandler([Chain.Polkadot, Chain.Kusama])
  async destinationUnexpected({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const payees = await this.stateQuery.payees(this.uniqueAddresses, blockNumber);
    for (let i = 0; i < this.uniqueAddresses.length; i++) {
      const address = this.uniqueAddresses[i];
      const destination = payees[address] ? this.getDestinationString(payees[address]) : 'None';
      for (const { account, alerts, groupId } of this.getAccounts(H.DestinationChanged, address)) {
        const expectedDestination = account.settings.payee;

        if (!expectedDestination) continue;
        const isFiring = destination !== expectedDestination;

        const message = this.createMessage(
          [
            `Unexpected reward destination detected for ${this.formatAccountLink(account)}.`,
            `Actual destination: ${destination}`,
            `Expected destination: ${expectedDestination}`,
          ],
          { blockNumber },
        );

        const key = `${account.ss58}:${groupId}:handleDestinationUnexpected`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }

  @EveryBlockHandler([Chain.Polkadot, Chain.Kusama])
  async activeSetPresense({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const validators = await this.stateQuery.validators(blockNumber);
    for (const acc of this.uniqueAddresses) {
      for (const { account, alerts, groupId } of this.getAccounts(H.ActiveSetPresence, acc)) {
        const isFiring = !validators[account.ss58];

        const message = this.createMessage([
          `Target ${this.formatAccountLink(account)} is not present in the validation active set.`,
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
