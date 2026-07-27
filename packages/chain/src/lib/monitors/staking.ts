import { Event, State, Call } from '../decorators';
import {
  StakingHandlerType as H,
  MonitorType,
  Chain,
  CallHandlerParams,
  EventHandlerParams,
} from '../../types';
import { AbstractMonitor } from './abstract-monitor';

/**
 * StakingMonitor processes validator- and reward-related conditions such as
 * commission, self-stake, and active set presence.
 *
 * Note: This monitor implements experimental era-based incident handling, which differs from
 * other monitors. When an account’s configured era range ends, any previously active incident
 * is automatically resolved, as it is no longer relevant outside its active era window.
 * This behavior is experimental and may or may not become part of the core monitoring logic
 * in the future.
 */
export class StakingMonitor extends AbstractMonitor<MonitorType.Staking> {
  private isAccountInEraRange(fromEra: number | undefined, untilEra: number | undefined, activeEra: number): boolean {
    if (fromEra !== undefined && activeEra < fromEra) return false;
    if (untilEra !== undefined && activeEra >= untilEra) return false;
    return true;
  }

  private formatEraRangeInfo(
    fromEra: number | undefined,
    untilEra: number | undefined,
    activeEra: number,
  ): string | null {
    if (fromEra === undefined && untilEra === undefined) return null;

    const parts: string[] = [];
    if (fromEra !== undefined) parts.push(`from ${fromEra}`);
    if (untilEra !== undefined) parts.push(`until ${untilEra}`);

    const range = parts.join(' ');
    const status =
      untilEra !== undefined && activeEra >= untilEra
        ? '(expired)'
        : fromEra !== undefined && activeEra < fromEra
          ? '(not started)'
          : '';

    return `Era: ${range ? range + ', ' : ''}active ${activeEra} ${status}`;
  }

  @Event(
    H.OffenceReportedEvent,
    [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo],
    'staking.OffenceReported',
  )
  async offenceReported({ payload }: EventHandlerParams<H.OffenceReportedEvent>): Promise<void> {
    for (const a of this.matched(payload.validator)) await a.report('Offence reported', []);
  }

  @Event(
    H.CommissionChangedEvent,
    [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo],
    'staking.ValidatorPrefsSet',
  )
  async commissionChanged({ payload }: EventHandlerParams<H.CommissionChangedEvent>): Promise<void> {
    const commission = payload.prefs.commission;
    for (const a of this.matched(payload.stash)) await a.report('Commission changed', [`Commission: ${commission}`]);
  }

  @Event(H.UnbondedEvent, [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo], 'staking.Unbonded')
  async unbonded({ payload }: EventHandlerParams<H.UnbondedEvent>): Promise<void> {
    for (const a of this.matched(payload.stash)) await a.report('Unbonded', [`Amount: ${this.balance(payload.amount)}`]);
  }

  @Call(
    H.DestinationChangedCall,
    [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo],
    ['Staking.set_payee', 'Staking.bond'],
  )
  async destinationChanged({ call, origin }: CallHandlerParams<H.DestinationChangedCall>): Promise<void> {
    const args = call.value.value;
    const payee = call.value.type === 'set_payee' ? args.payee : args.payee;
    // PAPI represents RewardDestination as an enum: { type: "Account", value: "SS58" } | { type: "Staked" } etc.
    const destination = payee?.type === 'Account' ? String(payee.value) : String(payee?.type ?? payee);

    for (const a of this.matched(origin)) await a.report('Reward destination changed', [`Destination: ${destination}`]);
  }

  @State(H.DestinationChangedState, [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async destinationChangedState(): Promise<void> {
    const addresses = this.reg.getUniqueAddresses();
    const [curr, prev] = await Promise.all([
      this.chain.stakingPayee(addresses, this.block.blockNumber),
      this.chain.stakingPayee(addresses, this.block.blockNumber - 1),
    ]);

    for (const a of this.watched()) {
      const currDestination = curr[a.ss58];
      const prevDestination = prev[a.ss58];
      if (currDestination !== null && prevDestination !== null && currDestination !== prevDestination) {
        await a.report('Reward destination changed', [`Previous: ${prevDestination}`, `Current: ${currDestination}`]);
      }
    }
  }

  @State(H.CommissionUnexpectedState, [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async commissionUnexpected(): Promise<void> {
    const [commissions, era] = await Promise.all([
      this.chain.stakingValidatorsCommission(this.reg.getUniqueAddresses(), this.block.blockNumber),
      this.chain.stakingActiveEra(this.block.blockNumber),
    ]);

    for (const a of this.watched()) {
      const commission = commissions[a.ss58];
      const expected = a.settings.commission;
      if (commission === null || !expected) continue;

      const { fromEra, untilEra } = a.settings;
      await a.track(
        'Commission above expected',
        [`Expected: ${expected}`, `Actual: ${commission}`, this.formatEraRangeInfo(fromEra, untilEra, era)],
        this.isAccountInEraRange(fromEra, untilEra, era) && commission > expected,
      );
    }
  }

  @State(H.SelfStakeUnexpectedState, [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async selfStakeUnexpected(): Promise<void> {
    // Note: The staking.ledger storage is still keyed by what was historically the controller address.
    // Although stash-controller separation is deprecated and staking.bonded now returns the same address,
    // we still need this two-step lookup process to access the ledger storage due to backward compatibility
    // with the existing storage layout.
    const addresses = this.reg.getUniqueAddresses();
    const [bondedInfo, era] = await Promise.all([
      this.chain.stakingBonded(addresses, this.block.blockNumber),
      this.chain.stakingActiveEra(this.block.blockNumber),
    ]);
    const bondedAddresses = Object.values(bondedInfo).filter((addr): addr is string => addr !== null);
    const ledgers = await this.chain.stakingLedgerActive(bondedAddresses, this.block.blockNumber);

    for (const a of this.watched()) {
      const bondedAddress = bondedInfo[a.ss58];
      if (!bondedAddress) continue;

      const stake = ledgers[bondedAddress];
      if (stake === null) continue;

      const expected = a.settings.selfStake;
      if (!expected) continue;

      const { fromEra, untilEra } = a.settings;
      await a.track(
        'Self-stake below expected',
        [
          `Expected: ${this.balance(expected)}`,
          `Actual: ${this.balance(stake)}`,
          this.formatEraRangeInfo(fromEra, untilEra, era),
        ],
        this.isAccountInEraRange(fromEra, untilEra, era) && stake < expected,
      );
    }
  }

  @State(H.ValidatorIntentionMissingState, [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async validatorIntentionMissing(): Promise<void> {
    const addresses = this.reg.getUniqueAddresses();
    const [bondedInfo, commissions, era] = await Promise.all([
      this.chain.stakingBonded(addresses, this.block.blockNumber),
      this.chain.stakingValidatorsCommission(addresses, this.block.blockNumber),
      this.chain.stakingActiveEra(this.block.blockNumber),
    ]);

    for (const a of this.watched()) {
      const isBonded = bondedInfo[a.ss58] !== null;
      const hasValidatorPrefs = commissions[a.ss58] !== null;

      const { fromEra, untilEra } = a.settings;
      await a.track(
        'Validator not fully set up',
        [
          !isBonded && 'Account is not bonded',
          !hasValidatorPrefs && 'No validator preferences set',
          this.formatEraRangeInfo(fromEra, untilEra, era),
        ],
        this.isAccountInEraRange(fromEra, untilEra, era) && (!isBonded || !hasValidatorPrefs),
      );
    }
  }

  @State(H.DestinationUnexpectedState, [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async destinationUnexpected(): Promise<void> {
    const [payees, era] = await Promise.all([
      this.chain.stakingPayee(this.reg.getUniqueAddresses(), this.block.blockNumber),
      this.chain.stakingActiveEra(this.block.blockNumber),
    ]);

    for (const a of this.watched()) {
      const destination = payees[a.ss58];
      const expected = a.settings.payee;
      if (destination === null || !expected) continue;

      const { fromEra, untilEra } = a.settings;
      await a.track(
        'Unexpected reward destination',
        [`Expected: ${expected}`, `Actual: ${destination}`, this.formatEraRangeInfo(fromEra, untilEra, era)],
        this.isAccountInEraRange(fromEra, untilEra, era) && destination !== expected,
      );
    }
  }

  @State(H.ActiveSetPresenceState, [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async activeSetPresense(): Promise<void> {
    const era = await this.chain.stakingActiveEra(this.block.blockNumber);
    const validators = await this.chain.stakingEraValidators(era, this.block.blockNumber);

    for (const a of this.watched()) {
      const { fromEra, untilEra } = a.settings;
      await a.track(
        'Not in active set',
        [this.formatEraRangeInfo(fromEra, untilEra, era) || `Era: ${era}`],
        this.isAccountInEraRange(fromEra, untilEra, era) && !validators[a.ss58],
      );
    }
  }
}
