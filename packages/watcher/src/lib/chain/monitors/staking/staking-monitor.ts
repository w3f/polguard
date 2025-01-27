import '@polkadot/api-augment/polkadot';
import { EveryBlockHandler, EventHandler, CallHandler } from '../../chain-decorators';
import { PalletStakingRewardDestination, PalletStakingValidatorPrefs } from '@polkadot/types/lookup';
import {
  StakingHandlerType as H,
  EveryBlockHandlerParams,
  CallHandlerParams,
  EventHandlerParams,
  MonitorType,
  Chain,
} from '@w3f/monitoring-types';
import { AbstractChainMonitor } from '../abstract-chain-monitor';

export class StakingMonitor extends AbstractChainMonitor<MonitorType.Staking> {
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
    const commissions = await this.provider.stakingValidatorsComission(this.uniqueAddresses, blockNumber);
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
            `Expected ${expectedCommission}, got ${commission}`,
          ],
          { blockNumber },
        );

        const key = `${account.ss58}:${groupId}:${H.CommissionUnexpected}`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }

  @EveryBlockHandler([Chain.Polkadot, Chain.Kusama])
  async selfStakeUnexpected({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    // Note: The staking.ledger storage is still keyed by what was historically the controller address.
    // Although stash-controller separation is deprecated and staking.bonded now returns the same address,
    // we still need this two-step lookup process to access the ledger storage due to backward compatibility
    // with the existing storage layout.
    const bondedInfo = await this.provider.stakingBonded(this.uniqueAddresses, blockNumber);
    const bondedAddresses = Object.values(bondedInfo).filter((addr): addr is string => addr !== null);
    const ledgers = await this.provider.stakingLedgerActive(bondedAddresses, blockNumber);
    for (const address of this.uniqueAddresses) {
      const bondedAddress = bondedInfo[address];
      if (!bondedAddress) continue;

      const stake = ledgers[bondedAddress];
      if (stake === null) continue;

      for (const { account, alerts, groupId } of this.getAccounts(H.SelfStakeUnexpected, address)) {
        const expectedStake = account.settings.selfStake;
        if (!expectedStake) continue;

        const comparisonType = account.settings.selfStakeComparison;
        const compareFunc = StakingMonitor.comparisonFunctions[comparisonType];
        const isFiring = !compareFunc(stake, expectedStake);

        const message = this.createMessage(
          [
            `Unexpected self-stake detected for ${this.formatAccountLink(account)}.`,
            `Expected ${this.formatBalance(expectedStake)}, got ${this.formatBalance(stake)}`,
          ],
          { blockNumber },
        );

        const key = `${account.ss58}:${groupId}:${H.SelfStakeUnexpected}`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }

  @EveryBlockHandler([Chain.Polkadot, Chain.Kusama])
  async validatorIntentionMissing({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const bondedInfo = await this.provider.stakingBonded(this.uniqueAddresses, blockNumber);
    const commissions = await this.provider.stakingValidatorsComission(this.uniqueAddresses, blockNumber);

    for (const address of this.uniqueAddresses) {
      for (const { account, alerts, groupId } of this.getAccounts(H.ValidatorIntentionMissing, address)) {
        const isBonded = bondedInfo[address] !== null;
        const hasValidatorPrefs = commissions[address] !== null;

        const isFiring = !isBonded || !hasValidatorPrefs;

        const messageLines = [`Account ${this.formatAccountLink(account)} is not properly set up as validator.`];
        if (!isBonded) {
          messageLines.push('Account is not bonded.');
        }
        if (!hasValidatorPrefs) {
          messageLines.push('No validator preferences (commission) set.');
        }

        const message = this.createMessage(messageLines, { blockNumber });

        const key = `${account.ss58}:${groupId}:${H.ValidatorIntentionMissing}`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }

  @EveryBlockHandler([Chain.Polkadot, Chain.Kusama])
  async destinationUnexpected({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const payees = await this.provider.stakingPayee(this.uniqueAddresses, blockNumber);
    for (const address of this.uniqueAddresses) {
      const destination = payees[address];
      if (destination === null) continue;

      for (const { account, alerts, groupId } of this.getAccounts(H.DestinationUnexpected, address)) {
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

        const key = `${account.ss58}:${groupId}:${H.DestinationUnexpected}`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }

  @EveryBlockHandler([Chain.Polkadot, Chain.Kusama])
  async activeSetPresense({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const validators = await this.provider.sessionValidators(blockNumber);
    for (const address of this.uniqueAddresses) {
      for (const { account, alerts, groupId } of this.getAccounts(H.ActiveSetPresence, address)) {
        const isFiring = !validators[account.ss58];

        const message = this.createMessage([
          `Target ${this.formatAccountLink(account)} is not present in the validation active set.`,
          `Era: ${await this.provider.stakingActiveEra(blockNumber)}`,
        ]);

        const key = `${account.ss58}:${groupId}:${H.ActiveSetPresence}`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }
}
