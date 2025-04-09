import '@polkadot/api-augment/polkadot';
import { Event, State, Handler, Call } from '../../../common/decorators';
import { PalletStakingRewardDestination, PalletStakingValidatorPrefs } from '@polkadot/types/lookup';
import {
  StakingHandlerType as H,
  StateHandlerParams,
  CallHandlerParams,
  EventHandlerParams,
  MonitorType,
  Chain,
  IncidentKey,
} from '@w3f/monitoring-types';
import { AbstractChainMonitor } from '../abstract-chain-monitor';

export class StakingMonitor extends AbstractChainMonitor<MonitorType.Staking> {
  @Event('staking.SlashReported', [Chain.Polkadot, Chain.Kusama])
  @Handler(H.SlashReported)
  async slashReported({ eventRecord, blockNumber, handler }: EventHandlerParams<H>): Promise<void> {
    const validatorId = eventRecord.event.data[0].toString();
    for (const { account, alerts, groupId } of this.getAccounts(handler, validatorId)) {
      const message = this.createMessage([`Validator ${account.name} has been slashed.`], {
        blockNumber,
        phase: eventRecord.phase,
      });

      const key: IncidentKey = { wallet: account.ss58, groupId, handler };
      await this.incidents.oneTimeIncident(message, alerts, key, blockNumber);
    }
  }

  @Event('staking.ValidatorPrefsSet', [Chain.Polkadot, Chain.Kusama])
  @Handler(H.CommissionChanged)
  async commissionChanged({ eventRecord, blockNumber, handler }: EventHandlerParams<H>): Promise<void> {
    const stash = eventRecord.event.data[0].toString();
    const prefs = eventRecord.event.data[1] as PalletStakingValidatorPrefs;
    for (const { account, alerts, groupId } of this.getAccounts(handler, stash)) {
      const message = this.createMessage(
        [`Commission change detected for ${this.formatAccountLink(account)}.`, `Commission: ${prefs.commission}`],
        { blockNumber, phase: eventRecord.phase },
      );

      const key: IncidentKey = { wallet: account.ss58, groupId, handler };
      await this.incidents.oneTimeIncident(message, alerts, key, blockNumber);
    }
  }

  @Call(['staking.setPayee', 'staking.bond'], [Chain.Polkadot, Chain.Kusama])
  @Handler(H.DestinationChanged)
  async destinationChanged({
    call,
    origin,
    blockNumber,
    extrinsicIndex,
    handler,
  }: CallHandlerParams<H>): Promise<void> {
    const payee = (call.method === 'setPayee' ? call.args[0] : call.args[1]) as PalletStakingRewardDestination;
    const destination = payee.isAccount ? payee.asAccount.toString() : payee.type;
    for (const { account, alerts, groupId } of this.getAccounts(handler, origin)) {
      const message = this.createMessage(
        [`Destination change detected for ${this.formatAccountLink(account)}.`, `Destination: ${destination}`],
        { blockNumber, extrinsicIndex },
      );

      const key: IncidentKey = { wallet: account.ss58, groupId, handler };
      await this.incidents.oneTimeIncident(message, alerts, key, blockNumber);
    }
  }

  @State([Chain.Polkadot, Chain.Kusama])
  @Handler(H.CommissionUnexpected)
  async commissionUnexpected({ blockNumber, handler }: StateHandlerParams<H>): Promise<void> {
    const commissions = await this.provider.stakingValidatorsCommission(this.uniqueAddresses, blockNumber);

    await this.forEachAccount(handler, async ({ account, alerts, groupId }) => {
      const commission = commissions[account.ss58];
      if (commission === null) return;

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

      const key: IncidentKey = { wallet: account.ss58, groupId, handler };
      await this.incidents.ongoingIncident(message, alerts, isFiring, key, blockNumber);
    });
  }

  @State([Chain.Polkadot, Chain.Kusama])
  @Handler(H.SelfStakeUnexpected)
  async selfStakeUnexpected({ blockNumber, handler }: StateHandlerParams<H>): Promise<void> {
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

      for (const { account, alerts, groupId } of this.getAccounts(handler, address)) {
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

        const key: IncidentKey = { wallet: account.ss58, groupId, handler };
        await this.incidents.ongoingIncident(message, alerts, isFiring, key, blockNumber);
      }
    }
  }

  @State([Chain.Polkadot, Chain.Kusama])
  @Handler(H.ValidatorIntentionMissing)
  async validatorIntentionMissing({ blockNumber, handler }: StateHandlerParams<H>): Promise<void> {
    const bondedInfo = await this.provider.stakingBonded(this.uniqueAddresses, blockNumber);
    const commissions = await this.provider.stakingValidatorsCommission(this.uniqueAddresses, blockNumber);

    await this.forEachAccount(handler, async ({ account, alerts, groupId }) => {
      const isBonded = bondedInfo[account.ss58] !== null;
      const hasValidatorPrefs = commissions[account.ss58] !== null;
      const isFiring = !isBonded || !hasValidatorPrefs;

      const messageLines = [`Account ${this.formatAccountLink(account)} is not properly set up as validator.`];
      if (!isBonded) {
        messageLines.push('Account is not bonded.');
      }
      if (!hasValidatorPrefs) {
        messageLines.push('No validator preferences (commission) set.');
      }

      const message = this.createMessage(messageLines, { blockNumber });

      const key: IncidentKey = { wallet: account.ss58, groupId, handler };
      await this.incidents.ongoingIncident(message, alerts, isFiring, key, blockNumber);
    });
  }

  @State([Chain.Polkadot, Chain.Kusama])
  @Handler(H.DestinationUnexpected)
  async destinationUnexpected({ blockNumber, handler }: StateHandlerParams<H>): Promise<void> {
    const payees = await this.provider.stakingPayee(this.uniqueAddresses, blockNumber);

    await this.forEachAccount(handler, async ({ account, alerts, groupId }) => {
      const destination = payees[account.ss58];
      if (destination === null) return;

      const expectedDestination = account.settings.payee;
      if (!expectedDestination) return;
      const isFiring = destination !== expectedDestination;

      const message = this.createMessage(
        [
          `Unexpected reward destination detected for ${this.formatAccountLink(account)}.`,
          `Expected "${expectedDestination}", got "${destination}"`,
        ],
        { blockNumber },
      );

      const key: IncidentKey = { wallet: account.ss58, groupId, handler };
      await this.incidents.ongoingIncident(message, alerts, isFiring, key, blockNumber);
    });
  }

  @State([Chain.Polkadot, Chain.Kusama])
  @Handler(H.ActiveSetPresence)
  async activeSetPresense({ blockNumber, handler }: StateHandlerParams<H>): Promise<void> {
    const validators = await this.provider.sessionValidators(blockNumber);
    await this.forEachAccount(handler, async ({ account, alerts, groupId }) => {
      const isFiring = !validators[account.ss58];

      const message = this.createMessage([
        `Target ${this.formatAccountLink(account)} is not present in the validation active set.`,
        `Era: ${await this.provider.stakingActiveEra(blockNumber)}`,
      ]);

      const key: IncidentKey = { wallet: account.ss58, groupId, handler };
      await this.incidents.ongoingIncident(message, alerts, isFiring, key, blockNumber);
    });
  }
}
