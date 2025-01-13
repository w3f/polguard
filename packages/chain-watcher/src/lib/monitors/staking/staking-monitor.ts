import '@polkadot/api-augment/polkadot';
import { EveryBlockHandler, EventHandler, CallHandler } from '../../decorators';
import { PalletStakingRewardDestination, PalletStakingValidatorPrefs } from '@polkadot/types/lookup';
import {
  StakingHandlerType as H,
  EveryBlockHandlerParams,
  CallHandlerParams,
  EventHandlerParams,
  MonitorType,
  Chain,
} from '@w3f/monitoring-types';
import { AbstractMonitor } from '../abstract-monitor';

export class StakingMonitor extends AbstractMonitor<MonitorType.Staking> {
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
        [`Commission change detected for ${this.formatAccountLink(account)}.`, `Commission: ${prefs.commission}`],
        { blockNumber, phase: eventRecord.phase },
      );

      await this.incidents.oneTimeIncident(message, alerts, blockNumber);
    }
  }

  @CallHandler(['staking.setPayee', 'staking.bond'], [Chain.Polkadot, Chain.Kusama])
  async destinationChanged({ call, origin, blockNumber, extrinsicIndex }: CallHandlerParams): Promise<void> {
    const payee = (call.method === 'setPayee' ? call.args[0] : call.args[1]) as PalletStakingRewardDestination;
    const destination = payee.isAccount ? payee.asAccount.toString() : payee.type;
    for (const { account, alerts } of this.getAccounts(H.DestinationChanged, origin)) {
      const message = this.createMessage(
        [`Destination change detected for ${this.formatAccountLink(account)}.`, `Destination: ${destination}`],
        { blockNumber, extrinsicIndex },
      );

      await this.incidents.oneTimeIncident(message, alerts, blockNumber);
    }
  }

  @EveryBlockHandler([Chain.Polkadot, Chain.Kusama])
  async commissionUnexpected({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const commissions = await this.stateQuery.stakingValidatorsComission(this.uniqueAddresses, blockNumber);
    for (const address of this.uniqueAddresses) {
      const commission = commissions[address];
      if (commission === null) continue;

      for (const { account, alerts, groupId } of this.getAccounts(H.CommissionUnexpected, address)) {
        const expectedCommission = account.settings.commission;
        const comparisonType = account.settings.commissionComparison;
        const compareFunc = StakingMonitor.comparisonFunctions[comparisonType];
        const isFiring = !compareFunc(commission, expectedCommission);

        const message = this.createMessage(
          [
            `Unexpected commission detected for ${this.formatAccountLink(account)}.`,
            `Expected "${expectedCommission}", got "${commission}"`,
          ],
          { blockNumber },
        );

        const key = `${account.ss58}:${groupId}:commissionUnexpected`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }

  @EveryBlockHandler([Chain.Polkadot, Chain.Kusama])
  async selfStakeUnexpected({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    // Note: stash–controller separation has largely been deprecated, the chain's storage layout
    // still relies on the controller address for staking.ledger. Therefore, we must first call
    // staking.bonded (to map from stash to controller) before querying staking.ledger to retrieve
    // a validator's self-stake. This remains necessary for backward compatibility with the existing
    // on-chain storage structure.
    const controllers = await this.stateQuery.stakingBonded(this.uniqueAddresses, blockNumber);
    const controllerAddresses = Object.values(controllers).filter((addr): addr is string => addr !== null);
    const ledgers = await this.stateQuery.stakingLedgerActive(controllerAddresses, blockNumber);

    for (const address of this.uniqueAddresses) {
      const controller = controllers[address];
      if (!controller) continue;

      const stake = ledgers[controller];
      if (stake === null) continue;

      for (const { account, alerts, groupId } of this.getAccounts(H.CommissionUnexpected, address)) {
        const expectedStake = account.settings.selfStake;
        if (expectedStake === null) continue;

        const comparisonType = account.settings.selfStakeComparison;
        const compareFunc = StakingMonitor.comparisonFunctions[comparisonType];
        const isFiring = !compareFunc(stake, expectedStake);

        const message = this.createMessage(
          [
            `Unexpected self-stake detected for ${this.formatAccountLink(account)}.`,
            `Expected "${this.formatBalance(expectedStake)}", got "${this.formatBalance(stake)}"`,
          ],
          { blockNumber },
        );

        const key = `${account.ss58}:${groupId}:selfStakeUnexpected`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }

  @EveryBlockHandler([Chain.Polkadot, Chain.Kusama])
  async destinationUnexpected({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const payees = await this.stateQuery.stakingPayee(this.uniqueAddresses, blockNumber);
    for (const address of this.uniqueAddresses) {
      const destination = payees[address];
      if (destination === null) continue;

      for (const { account, alerts, groupId } of this.getAccounts(H.DestinationChanged, address)) {
        const expectedDestination = account.settings.payee;
        if (!expectedDestination) continue;
        const isFiring = destination !== expectedDestination;

        const message = this.createMessage(
          [
            `Unexpected reward destination detected for ${this.formatAccountLink(account)}.`,
            `Expected "${expectedDestination}", got "${destination}"`,
          ],
          { blockNumber },
        );

        const key = `${account.ss58}:${groupId}:destinationUnexpected`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }

  @EveryBlockHandler([Chain.Polkadot, Chain.Kusama])
  async activeSetPresense({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const validators = await this.stateQuery.sessionValidators(blockNumber);
    for (const address of this.uniqueAddresses) {
      for (const { account, alerts, groupId } of this.getAccounts(H.ActiveSetPresence, address)) {
        const isFiring = !validators[account.ss58];

        const message = this.createMessage([
          `Target ${this.formatAccountLink(account)} is not present in the validation active set.`,
          `Era: ${await this.stateQuery.stakingActiveEra(blockNumber)}`,
        ]);

        const key = `${account.ss58}:${groupId}:activeSetPresense`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }
}
