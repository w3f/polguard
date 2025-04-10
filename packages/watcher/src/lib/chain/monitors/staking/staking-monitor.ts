import '@polkadot/api-augment/polkadot';
import { Event, State, Call, IncidentPayload } from '../../../common/decorators';
import { PalletStakingRewardDestination, PalletStakingValidatorPrefs } from '@polkadot/types/lookup';
import {
  StakingHandlerType as H,
  StateHandlerParams,
  CallHandlerParams,
  EventHandlerParams,
  MonitorType,
  Chain,
} from '@w3f/monitoring-types';
import { AbstractChainMonitor } from '../abstract-chain-monitor';

export class StakingMonitor extends AbstractChainMonitor<MonitorType.Staking> {
  @Event(H.SlashReported, [Chain.Polkadot, Chain.Kusama], 'staking.SlashReported')
  async slashReported({
    eventRecord,
    blockNumber,
    handler,
  }: EventHandlerParams<H.SlashReported>): Promise<IncidentPayload[]> {
    const validatorId = eventRecord.event.data[0].toString();
    const incidents: IncidentPayload[] = [];

    for (const { account, alerts, groupId } of this.getAccounts(handler, validatorId)) {
      const message = this.createMessage([`Validator ${account.name} has been slashed.`], {
        blockNumber,
        phase: eventRecord.phase,
      });
      const key = { wallet: account.ss58, groupId, handler };
      incidents.push({ message, alerts, key, blockNumber });
    }
    return incidents;
  }

  @Event(H.CommissionChanged, [Chain.Polkadot, Chain.Kusama], 'staking.ValidatorPrefsSet')
  async commissionChanged({
    eventRecord,
    blockNumber,
    handler,
  }: EventHandlerParams<H.CommissionChanged>): Promise<IncidentPayload[]> {
    const stash = eventRecord.event.data[0].toString();
    const prefs = eventRecord.event.data[1] as PalletStakingValidatorPrefs;
    const incidents: IncidentPayload[] = [];

    for (const { account, alerts, groupId } of this.getAccounts(handler, stash)) {
      const message = this.createMessage(
        [`Commission change detected for ${this.formatAccountLink(account)}.`, `Commission: ${prefs.commission}`],
        { blockNumber, phase: eventRecord.phase },
      );
      const key = { wallet: account.ss58, groupId, handler };
      incidents.push({ message, alerts, key, blockNumber });
    }
    return incidents;
  }

  @Call(H.DestinationChanged, [Chain.Polkadot, Chain.Kusama], ['staking.setPayee', 'staking.bond'])
  async destinationChanged({
    call,
    origin,
    blockNumber,
    extrinsicIndex,
    handler,
  }: CallHandlerParams<H.DestinationChanged>): Promise<IncidentPayload[]> {
    const payee = (call.method === 'setPayee' ? call.args[0] : call.args[1]) as PalletStakingRewardDestination;
    const destination = payee.isAccount ? payee.asAccount.toString() : payee.type;
    const incidents: IncidentPayload[] = [];

    for (const { account, alerts, groupId } of this.getAccounts(handler, origin)) {
      const message = this.createMessage(
        [`Destination change detected for ${this.formatAccountLink(account)}.`, `Destination: ${destination}`],
        { blockNumber, extrinsicIndex },
      );
      const key = { wallet: account.ss58, groupId, handler };
      incidents.push({ message, alerts, key, blockNumber });
    }
    return incidents;
  }

  @State(H.CommissionUnexpected, [Chain.Polkadot, Chain.Kusama])
  async commissionUnexpected({
    blockNumber,
    handler,
  }: StateHandlerParams<H.CommissionUnexpected>): Promise<IncidentPayload[]> {
    const commissions = await this.provider.stakingValidatorsCommission(this.uniqueAddresses, blockNumber);
    const incidents: IncidentPayload[] = [];

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
      const key = { wallet: account.ss58, groupId, handler };
      incidents.push({ message, alerts, key, blockNumber, isFiring });
    });
    return incidents;
  }

  @State(H.SelfStakeUnexpected, [Chain.Polkadot, Chain.Kusama])
  async selfStakeUnexpected({
    blockNumber,
    handler,
  }: StateHandlerParams<H.SelfStakeUnexpected>): Promise<IncidentPayload[]> {
    // Note: The staking.ledger storage is still keyed by what was historically the controller address.
    // Although stash-controller separation is deprecated and staking.bonded now returns the same address,
    // we still need this two-step lookup process to access the ledger storage due to backward compatibility
    // with the existing storage layout.
    const bondedInfo = await this.provider.stakingBonded(this.uniqueAddresses, blockNumber);
    const bondedAddresses = Object.values(bondedInfo).filter((addr): addr is string => addr !== null);
    const ledgers = await this.provider.stakingLedgerActive(bondedAddresses, blockNumber);
    const incidents: IncidentPayload[] = [];

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
        const key = { wallet: account.ss58, groupId, handler };
        incidents.push({ message, alerts, key, blockNumber, isFiring });
      }
    }
    return incidents;
  }

  @State(H.ValidatorIntentionMissing, [Chain.Polkadot, Chain.Kusama])
  async validatorIntentionMissing({
    blockNumber,
    handler,
  }: StateHandlerParams<H.ValidatorIntentionMissing>): Promise<IncidentPayload[]> {
    const bondedInfo = await this.provider.stakingBonded(this.uniqueAddresses, blockNumber);
    const commissions = await this.provider.stakingValidatorsCommission(this.uniqueAddresses, blockNumber);
    const incidents: IncidentPayload[] = [];

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
      const key = { wallet: account.ss58, groupId, handler };
      incidents.push({ message, alerts, key, blockNumber, isFiring });
    });

    return incidents;
  }

  @State(H.DestinationUnexpected, [Chain.Polkadot, Chain.Kusama])
  async destinationUnexpected({
    blockNumber,
    handler,
  }: StateHandlerParams<H.DestinationUnexpected>): Promise<IncidentPayload[]> {
    const payees = await this.provider.stakingPayee(this.uniqueAddresses, blockNumber);
    const incidents: IncidentPayload[] = [];

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
      const key = { wallet: account.ss58, groupId, handler };
      incidents.push({ message, alerts, key, blockNumber, isFiring });
    });

    return incidents;
  }

  @State(H.ActiveSetPresence, [Chain.Polkadot, Chain.Kusama])
  async activeSetPresense({
    blockNumber,
    handler,
  }: StateHandlerParams<H.ActiveSetPresence>): Promise<IncidentPayload[]> {
    const validators = await this.provider.sessionValidators(blockNumber);
    const incidents: IncidentPayload[] = [];

    await this.forEachAccount(handler, async ({ account, alerts, groupId }) => {
      const isFiring = !validators[account.ss58];
      const message = this.createMessage([
        `Target ${this.formatAccountLink(account)} is not present in the validation active set.`,
        `Era: ${await this.provider.stakingActiveEra(blockNumber)}`,
      ]);
      const key = { wallet: account.ss58, groupId, handler };
      incidents.push({ message, alerts, key, blockNumber, isFiring });
    });

    return incidents;
  }
}
