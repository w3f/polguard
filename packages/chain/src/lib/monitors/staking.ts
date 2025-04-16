import '@polkadot/api-augment/polkadot';
import { Event, State, Call } from '../decorators';
import { PalletStakingRewardDestination, PalletStakingValidatorPrefs } from '@polkadot/types/lookup';
import {
  StakingHandlerType as H,
  StateHandlerParams,
  CallHandlerParams,
  EventHandlerParams,
  MonitorType,
  Chain,
} from '@w3f/monitoring-types';
import { AbstractMonitor } from './abstract-monitor';

export class StakingMonitor extends AbstractMonitor<MonitorType.Staking> {
  @Event(H.SlashReported, [Chain.Polkadot, Chain.Kusama], 'staking.SlashReported')
  async slashReported({ eventRecord, blockNumber, handler }: EventHandlerParams<H.SlashReported>): Promise<void> {
    const validatorId = eventRecord.event.data[0].toString();

    for (const { account, alerts, groupId } of this.reg.getAccounts(handler, validatorId)) {
      const message = this.fmt.message([`Validator ${account.name} has been slashed.`], {
        blockNumber,
        phase: eventRecord.phase,
      });
      const key = { wallet: account.ss58, groupId, handler };
      await this.incidents.handle(message, alerts, key, blockNumber);
    }
  }

  @Event(H.CommissionChanged, [Chain.Polkadot, Chain.Kusama], 'staking.ValidatorPrefsSet')
  async commissionChanged({
    eventRecord,
    blockNumber,
    handler,
  }: EventHandlerParams<H.CommissionChanged>): Promise<void> {
    const stash = eventRecord.event.data[0].toString();
    const prefs = eventRecord.event.data[1] as PalletStakingValidatorPrefs;

    for (const { account, alerts, groupId } of this.reg.getAccounts(handler, stash)) {
      const message = this.fmt.message(
        [`Commission change detected for ${this.fmt.accountLink(account)}.`, `Commission: ${prefs.commission}`],
        { blockNumber, phase: eventRecord.phase },
      );
      const key = { wallet: account.ss58, groupId, handler };
      await this.incidents.handle(message, alerts, key, blockNumber);
    }
  }

  @Call(H.DestinationChanged, [Chain.Polkadot, Chain.Kusama], ['staking.setPayee', 'staking.bond'])
  async destinationChanged({
    call,
    origin,
    blockNumber,
    extrinsicIndex,
    handler,
  }: CallHandlerParams<H.DestinationChanged>): Promise<void> {
    const payee = (call.method === 'setPayee' ? call.args[0] : call.args[1]) as PalletStakingRewardDestination;
    const destination = payee.isAccount ? payee.asAccount.toString() : payee.type;

    for (const { account, alerts, groupId } of this.reg.getAccounts(handler, origin)) {
      const message = this.fmt.message(
        [`Destination change detected for ${this.fmt.accountLink(account)}.`, `Destination: ${destination}`],
        { blockNumber, extrinsicIndex },
      );
      const key = { wallet: account.ss58, groupId, handler };
      await this.incidents.handle(message, alerts, key, blockNumber);
    }
  }

  @State(H.CommissionUnexpected, [Chain.Polkadot, Chain.Kusama])
  async commissionUnexpected({ blockNumber, handler }: StateHandlerParams<H.CommissionUnexpected>): Promise<void> {
    const addresses = this.reg.getUniqueAddresses();
    const commissions = await this.chain.stakingValidatorsCommission(addresses, blockNumber);

    await this.reg.forEachAccount(handler, async ({ account, alerts, groupId }) => {
      const commission = commissions[account.ss58];
      if (commission === null) return;

      const expectedCommission = account.settings.commission;
      const comparisonType = account.settings.commissionComparison;
      const compareFunc = StakingMonitor.comparisonFunctions[comparisonType];
      const isFiring = !compareFunc(commission, expectedCommission);
      const message = this.fmt.message(
        [
          `Unexpected commission detected for ${this.fmt.accountLink(account)}.`,
          `Expected ${expectedCommission}, got ${commission}`,
        ],
        { blockNumber },
      );
      const key = { wallet: account.ss58, groupId, handler };
      await this.incidents.handle(message, alerts, key, blockNumber, isFiring);
    });
  }

  @State(H.SelfStakeUnexpected, [Chain.Polkadot, Chain.Kusama])
  async selfStakeUnexpected({ blockNumber, handler }: StateHandlerParams<H.SelfStakeUnexpected>): Promise<void> {
    // Note: The staking.ledger storage is still keyed by what was historically the controller address.
    // Although stash-controller separation is deprecated and staking.bonded now returns the same address,
    // we still need this two-step lookup process to access the ledger storage due to backward compatibility
    // with the existing storage layout.
    const addresses = this.reg.getUniqueAddresses();
    const bondedInfo = await this.chain.stakingBonded(addresses, blockNumber);
    const bondedAddresses = Object.values(bondedInfo).filter((addr): addr is string => addr !== null);
    const ledgers = await this.chain.stakingLedgerActive(bondedAddresses, blockNumber);

    for (const address of addresses) {
      const bondedAddress = bondedInfo[address];
      if (!bondedAddress) continue;

      const stake = ledgers[bondedAddress];
      if (stake === null) continue;

      for (const { account, alerts, groupId } of this.reg.getAccounts(handler, address)) {
        const expectedStake = account.settings.selfStake;
        if (!expectedStake) continue;

        const comparisonType = account.settings.selfStakeComparison;
        const compareFunc = StakingMonitor.comparisonFunctions[comparisonType];
        const isFiring = !compareFunc(stake, expectedStake);
        const message = this.fmt.message(
          [
            `Unexpected self-stake detected for ${this.fmt.accountLink(account)}.`,
            `Expected ${this.fmt.balance(expectedStake)}, got ${this.fmt.balance(stake)}`,
          ],
          { blockNumber },
        );
        const key = { wallet: account.ss58, groupId, handler };
        await this.incidents.handle(message, alerts, key, blockNumber, isFiring);
      }
    }
  }

  @State(H.ValidatorIntentionMissing, [Chain.Polkadot, Chain.Kusama])
  async validatorIntentionMissing({
    blockNumber,
    handler,
  }: StateHandlerParams<H.ValidatorIntentionMissing>): Promise<void> {
    const addresses = this.reg.getUniqueAddresses();
    const bondedInfo = await this.chain.stakingBonded(addresses, blockNumber);
    const commissions = await this.chain.stakingValidatorsCommission(addresses, blockNumber);

    await this.reg.forEachAccount(handler, async ({ account, alerts, groupId }) => {
      const isBonded = bondedInfo[account.ss58] !== null;
      const hasValidatorPrefs = commissions[account.ss58] !== null;
      const isFiring = !isBonded || !hasValidatorPrefs;

      const messageLines = [`Account ${this.fmt.accountLink(account)} is not properly set up as validator.`];
      if (!isBonded) {
        messageLines.push('Account is not bonded.');
      }
      if (!hasValidatorPrefs) {
        messageLines.push('No validator preferences (commission) set.');
      }

      const message = this.fmt.message(messageLines, { blockNumber });
      const key = { wallet: account.ss58, groupId, handler };
      await this.incidents.handle(message, alerts, key, blockNumber, isFiring);
    });
  }

  @State(H.DestinationUnexpected, [Chain.Polkadot, Chain.Kusama])
  async destinationUnexpected({ blockNumber, handler }: StateHandlerParams<H.DestinationUnexpected>): Promise<void> {
    const addresses = this.reg.getUniqueAddresses();
    const payees = await this.chain.stakingPayee(addresses, blockNumber);

    await this.reg.forEachAccount(handler, async ({ account, alerts, groupId }) => {
      const destination = payees[account.ss58];
      if (destination === null) return;

      const expectedDestination = account.settings.payee;
      if (!expectedDestination) return;
      const isFiring = destination !== expectedDestination;
      const message = this.fmt.message(
        [
          `Unexpected reward destination detected for ${this.fmt.accountLink(account)}.`,
          `Expected "${expectedDestination}", got "${destination}"`,
        ],
        { blockNumber },
      );
      const key = { wallet: account.ss58, groupId, handler };
      await this.incidents.handle(message, alerts, key, blockNumber, isFiring);
    });
  }

  @State(H.ActiveSetPresence, [Chain.Polkadot, Chain.Kusama])
  async activeSetPresense({ blockNumber, handler }: StateHandlerParams<H.ActiveSetPresence>): Promise<void> {
    const validators = await this.chain.sessionValidators(blockNumber);

    await this.reg.forEachAccount(handler, async ({ account, alerts, groupId }) => {
      const isFiring = !validators[account.ss58];
      const message = this.fmt.message(
        [
          `Target ${this.fmt.accountLink(account)} is not present in the validation active set.`,
          `Era: ${await this.chain.stakingActiveEra(blockNumber)}`,
        ],
        { blockNumber },
      );
      const key = { wallet: account.ss58, groupId, handler };
      await this.incidents.handle(message, alerts, key, blockNumber, isFiring);
    });
  }
}
