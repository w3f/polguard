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
} from '@w3f/polguard-common';
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
    H.SlashReportedEvent,
    [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo],
    'staking.SlashReported',
  )
  async slashReported({
    eventRecord,
    blockContext,
    handlerType,
  }: EventHandlerParams<H.SlashReportedEvent>): Promise<void> {
    const validatorId = eventRecord.event.data[0].toString();

    for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, validatorId)) {
      const message = this.fmt.message([`Validator ${account.name} has been slashed`], blockContext);
      const key = { account: account.ss58, groupId, handlerType };
      await this.incidents.handle(message, notifications, key, blockContext);
    }
  }

  @Event(
    H.CommissionChangedEvent,
    [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo],
    'staking.ValidatorPrefsSet',
  )
  async commissionChanged({
    eventRecord,
    blockContext,
    handlerType,
  }: EventHandlerParams<H.CommissionChangedEvent>): Promise<void> {
    const stash = eventRecord.event.data[0].toString();
    const prefs = eventRecord.event.data[1] as PalletStakingValidatorPrefs;

    for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, stash)) {
      const message = this.fmt.message(
        [
          `Commission change detected for ${this.fmt.accountLink(account.name, account.ss58)}`,
          `Commission: ${prefs.commission}`,
        ],
        blockContext,
      );
      const key = { account: account.ss58, groupId, handlerType };
      await this.incidents.handle(message, notifications, key, blockContext);
    }
  }

  @Event(H.UnbondedEvent, [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo], 'staking.Unbonded')
  async unbonded({ eventRecord, blockContext, handlerType }: EventHandlerParams<H.UnbondedEvent>): Promise<void> {
    const [stash, amount] = eventRecord.event.data.map(d => d.toString());

    for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, stash)) {
      const message = this.fmt.message(
        [
          `Unbond detected for ${this.fmt.accountLink(account.name, account.ss58)}`,
          `Amount: ${this.fmt.balance(amount)}`,
        ],
        blockContext,
      );
      const key = { account: account.ss58, groupId, handlerType };
      await this.incidents.handle(message, notifications, key, blockContext);
    }
  }

  @Call(
    H.DestinationChangedCall,
    [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo],
    ['staking.setPayee', 'staking.bond'],
  )
  async destinationChanged({
    call,
    origin,
    blockContext,
    handlerType,
  }: CallHandlerParams<H.DestinationChangedCall>): Promise<void> {
    const payee = (call.method === 'setPayee' ? call.args[0] : call.args[1]) as PalletStakingRewardDestination;
    const destination = payee.isAccount ? payee.asAccount.toString() : payee.type;

    for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, origin)) {
      const message = this.fmt.message(
        [
          `Destination change detected for ${this.fmt.accountLink(account.name, account.ss58)}`,
          `Destination: ${destination}`,
        ],
        blockContext,
      );
      const key = { account: account.ss58, groupId, handlerType };
      await this.incidents.handle(message, notifications, key, blockContext);
    }
  }

  @State(H.DestinationChangedState, [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async destinationChangedState({
    blockContext,
    handlerType,
  }: StateHandlerParams<H.DestinationChangedState>): Promise<void> {
    const addresses = this.reg.getUniqueAddresses();
    const [curr, prev] = await Promise.all([
      this.chain.stakingPayee(addresses, blockContext.blockNumber),
      this.chain.stakingPayee(addresses, blockContext.blockNumber - 1),
    ]);

    for (const address of addresses) {
      const currDestination = curr[address];
      const prevDestination = prev[address];

      for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, address)) {
        if (currDestination !== null && prevDestination !== null && currDestination !== prevDestination) {
          const message = this.fmt.message(
            [
              `Reward destination changed for ${this.fmt.accountLink(account.name, account.ss58)}`,
              `Previous: ${prevDestination}`,
              `Current: ${currDestination}`,
            ],
            blockContext,
          );
          const key = { account: account.ss58, groupId, handlerType };
          await this.incidents.handle(message, notifications, key, blockContext);
        }
      }
    }
  }

  @State(H.CommissionUnexpectedState, [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async commissionUnexpected({
    blockContext,
    handlerType,
  }: StateHandlerParams<H.CommissionUnexpectedState>): Promise<void> {
    const addresses = this.reg.getUniqueAddresses();
    const [commissions, activeEra] = await Promise.all([
      this.chain.stakingValidatorsCommission(addresses, blockContext.blockNumber),
      this.chain.stakingActiveEra(blockContext.blockNumber),
    ]);

    await this.reg.forEachAccount(handlerType, async ({ account, notifications, groupId }) => {
      const { fromEra, untilEra } = account.settings;

      const commission = commissions[account.ss58];
      if (commission === null) return;

      const expectedCommission = account.settings?.commission;
      if (!expectedCommission) return;

      const inRange = this.isAccountInEraRange(fromEra, untilEra, activeEra);
      const isFiring = inRange && commission > expectedCommission;
      const message = this.fmt.message(
        [
          `Unexpected commission detected for ${this.fmt.accountLink(account.name, account.ss58)}`,
          `Expected ${expectedCommission}, got ${commission}`,
          this.formatEraRangeInfo(fromEra, untilEra, activeEra),
        ],
        blockContext,
      );
      const key = { account: account.ss58, groupId, handlerType };
      await this.incidents.handle(message, notifications, key, blockContext, isFiring);
    });
  }

  @State(H.SelfStakeUnexpectedState, [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async selfStakeUnexpected({
    blockContext,
    handlerType,
  }: StateHandlerParams<H.SelfStakeUnexpectedState>): Promise<void> {
    // Note: The staking.ledger storage is still keyed by what was historically the controller address.
    // Although stash-controller separation is deprecated and staking.bonded now returns the same address,
    // we still need this two-step lookup process to access the ledger storage due to backward compatibility
    // with the existing storage layout.
    const addresses = this.reg.getUniqueAddresses();
    const [bondedInfo, activeEra] = await Promise.all([
      this.chain.stakingBonded(addresses, blockContext.blockNumber),
      this.chain.stakingActiveEra(blockContext.blockNumber),
    ]);
    const bondedAddresses = Object.values(bondedInfo).filter((addr): addr is string => addr !== null);
    const ledgers = await this.chain.stakingLedgerActive(bondedAddresses, blockContext.blockNumber);

    for (const address of addresses) {
      const bondedAddress = bondedInfo[address];
      if (!bondedAddress) continue;

      const stake = ledgers[bondedAddress];
      if (stake === null) continue;

      for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, address)) {
        const { fromEra, untilEra } = account.settings;
        const expectedStake = account.settings?.selfStake;
        if (!expectedStake) continue;

        const inRange = this.isAccountInEraRange(fromEra, untilEra, activeEra);
        const isFiring = inRange && stake < expectedStake;
        const message = this.fmt.message(
          [
            `Unexpected self-stake detected for ${this.fmt.accountLink(account.name, account.ss58)}`,
            `Expected ${this.fmt.balance(expectedStake)}, got ${this.fmt.balance(stake)}`,
            this.formatEraRangeInfo(fromEra, untilEra, activeEra),
          ],
          blockContext,
        );
        const key = { account: account.ss58, groupId, handlerType };
        await this.incidents.handle(message, notifications, key, blockContext, isFiring);
      }
    }
  }

  @State(H.ValidatorIntentionMissingState, [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async validatorIntentionMissing({
    blockContext,
    handlerType,
  }: StateHandlerParams<H.ValidatorIntentionMissingState>): Promise<void> {
    const addresses = this.reg.getUniqueAddresses();
    const [bondedInfo, commissions, activeEra] = await Promise.all([
      this.chain.stakingBonded(addresses, blockContext.blockNumber),
      this.chain.stakingValidatorsCommission(addresses, blockContext.blockNumber),
      this.chain.stakingActiveEra(blockContext.blockNumber),
    ]);

    await this.reg.forEachAccount(handlerType, async ({ account, notifications, groupId }) => {
      const { fromEra, untilEra } = account.settings;
      const isBonded = bondedInfo[account.ss58] !== null;
      const hasValidatorPrefs = commissions[account.ss58] !== null;

      const inRange = this.isAccountInEraRange(fromEra, untilEra, activeEra);
      const isFiring = inRange && (!isBonded || !hasValidatorPrefs);

      const message = this.fmt.message(
        [
          `Account ${this.fmt.accountLink(account.name, account.ss58)} is not properly set up as validator`,
          !isBonded && 'Account is not bonded.',
          !hasValidatorPrefs && 'No validator preferences (commission) set.',
          this.formatEraRangeInfo(fromEra, untilEra, activeEra),
        ],
        blockContext,
      );
      const key = { account: account.ss58, groupId, handlerType };
      await this.incidents.handle(message, notifications, key, blockContext, isFiring);
    });
  }

  @State(H.DestinationUnexpectedState, [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async destinationUnexpected({
    blockContext,
    handlerType,
  }: StateHandlerParams<H.DestinationUnexpectedState>): Promise<void> {
    const addresses = this.reg.getUniqueAddresses();
    const [payees, activeEra] = await Promise.all([
      this.chain.stakingPayee(addresses, blockContext.blockNumber),
      this.chain.stakingActiveEra(blockContext.blockNumber),
    ]);

    await this.reg.forEachAccount(handlerType, async ({ account, notifications, groupId }) => {
      const { fromEra, untilEra } = account.settings;

      const destination = payees[account.ss58];
      if (destination === null) return;

      const expectedDestination = account.settings?.payee;
      if (!expectedDestination) return;

      const inRange = this.isAccountInEraRange(fromEra, untilEra, activeEra);
      const isFiring = inRange && destination !== expectedDestination;
      const message = this.fmt.message(
        [
          `Unexpected reward destination detected for ${this.fmt.accountLink(account.name, account.ss58)}`,
          `Expected "${expectedDestination}", got "${destination}"`,
          this.formatEraRangeInfo(fromEra, untilEra, activeEra),
        ],
        blockContext,
      );
      const key = { account: account.ss58, groupId, handlerType };
      await this.incidents.handle(message, notifications, key, blockContext, isFiring);
    });
  }

  @State(H.ActiveSetPresenceState, [Chain.AssetHubPolkadot, Chain.AssetHubKusama])
  async activeSetPresense({ blockContext, handlerType }: StateHandlerParams<H.ActiveSetPresenceState>): Promise<void> {
    const activeEra = await this.chain.stakingActiveEra(blockContext.blockNumber);
    const validators = await this.chain.stakingEraValidators(activeEra, blockContext.blockNumber);

    await this.reg.forEachAccount(handlerType, async ({ account, notifications, groupId }) => {
      const { fromEra, untilEra } = account.settings;

      const inRange = this.isAccountInEraRange(fromEra, untilEra, activeEra);
      const isFiring = inRange && !validators[account.ss58];
      const message = this.fmt.message(
        [
          `Target ${this.fmt.accountLink(account.name, account.ss58)} is not present in the validation active set`,
          this.formatEraRangeInfo(fromEra, untilEra, activeEra) || `Era: ${activeEra}`,
        ],
        blockContext,
      );
      const key = { account: account.ss58, groupId, handlerType };
      await this.incidents.handle(message, notifications, key, blockContext, isFiring);
    });
  }
}
