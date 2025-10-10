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
  @Event(H.SlashReportedEvent, [Chain.Polkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo], 'staking.SlashReported')
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
    [Chain.Polkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo],
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

  @Event(H.UnbondedEvent, [Chain.Polkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo], 'staking.Unbonded')
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
    [Chain.Polkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo],
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

  @State(H.DestinationChangedState, [Chain.Polkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async destinationChangedState({
    blockContext,
    handlerType,
  }: StateHandlerParams<H.DestinationChangedState>): Promise<void> {
    const addresses = this.reg.getUniqueAddresses();
    const [curr, prev] = await Promise.all([
      await this.chain.stakingPayee(addresses, blockContext.blockNumber),
      await this.chain.stakingPayee(addresses, blockContext.blockNumber - 1),
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

  @State(H.CommissionUnexpectedState, [Chain.Polkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async commissionUnexpected({
    blockContext,
    handlerType,
  }: StateHandlerParams<H.CommissionUnexpectedState>): Promise<void> {
    const addresses = this.reg.getUniqueAddresses();
    const commissions = await this.chain.stakingValidatorsCommission(addresses, blockContext.blockNumber);

    await this.reg.forEachAccount(handlerType, async ({ account, notifications, groupId }) => {
      const commission = commissions[account.ss58];
      if (commission === null) return;

      const expectedCommission = account.settings?.commission;
      if (!expectedCommission) return;

      const isFiring = commission > expectedCommission;
      const message = this.fmt.message(
        [
          `Unexpected commission detected for ${this.fmt.accountLink(account.name, account.ss58)}`,
          `Expected ${expectedCommission}, got ${commission}`,
        ],
        blockContext,
      );
      const key = { account: account.ss58, groupId, handlerType };
      await this.incidents.handle(message, notifications, key, blockContext, isFiring);
    });
  }

  @State(H.SelfStakeUnexpectedState, [Chain.Polkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async selfStakeUnexpected({
    blockContext,
    handlerType,
  }: StateHandlerParams<H.SelfStakeUnexpectedState>): Promise<void> {
    // Note: The staking.ledger storage is still keyed by what was historically the controller address.
    // Although stash-controller separation is deprecated and staking.bonded now returns the same address,
    // we still need this two-step lookup process to access the ledger storage due to backward compatibility
    // with the existing storage layout.
    const addresses = this.reg.getUniqueAddresses();
    const bondedInfo = await this.chain.stakingBonded(addresses, blockContext.blockNumber);
    const bondedAddresses = Object.values(bondedInfo).filter((addr): addr is string => addr !== null);
    const ledgers = await this.chain.stakingLedgerActive(bondedAddresses, blockContext.blockNumber);

    for (const address of addresses) {
      const bondedAddress = bondedInfo[address];
      if (!bondedAddress) continue;

      const stake = ledgers[bondedAddress];
      if (stake === null) continue;

      for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, address)) {
        const expectedStake = account.settings?.selfStake;
        if (!expectedStake) continue;

        const isFiring = stake < expectedStake;
        const message = this.fmt.message(
          [
            `Unexpected self-stake detected for ${this.fmt.accountLink(account.name, account.ss58)}`,
            `Expected ${this.fmt.balance(expectedStake)}, got ${this.fmt.balance(stake)}`,
          ],
          blockContext,
        );
        const key = { account: account.ss58, groupId, handlerType };
        await this.incidents.handle(message, notifications, key, blockContext, isFiring);
      }
    }
  }

  @State(H.ValidatorIntentionMissingState, [Chain.Polkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async validatorIntentionMissing({
    blockContext,
    handlerType,
  }: StateHandlerParams<H.ValidatorIntentionMissingState>): Promise<void> {
    const addresses = this.reg.getUniqueAddresses();
    const bondedInfo = await this.chain.stakingBonded(addresses, blockContext.blockNumber);
    const commissions = await this.chain.stakingValidatorsCommission(addresses, blockContext.blockNumber);

    await this.reg.forEachAccount(handlerType, async ({ account, notifications, groupId }) => {
      const isBonded = bondedInfo[account.ss58] !== null;
      const hasValidatorPrefs = commissions[account.ss58] !== null;
      const isFiring = !isBonded || !hasValidatorPrefs;

      const messageLines = [
        `Account ${this.fmt.accountLink(account.name, account.ss58)} is not properly set up as validator`,
      ];
      if (!isBonded) {
        messageLines.push('Account is not bonded.');
      }
      if (!hasValidatorPrefs) {
        messageLines.push('No validator preferences (commission) set.');
      }

      const message = this.fmt.message(messageLines, blockContext);
      const key = { account: account.ss58, groupId, handlerType };
      await this.incidents.handle(message, notifications, key, blockContext, isFiring);
    });
  }

  @State(H.DestinationUnexpectedState, [Chain.Polkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo])
  async destinationUnexpected({
    blockContext,
    handlerType,
  }: StateHandlerParams<H.DestinationUnexpectedState>): Promise<void> {
    const addresses = this.reg.getUniqueAddresses();
    const payees = await this.chain.stakingPayee(addresses, blockContext.blockNumber);

    await this.reg.forEachAccount(handlerType, async ({ account, notifications, groupId }) => {
      const destination = payees[account.ss58];
      if (destination === null) return;

      const expectedDestination = account.settings?.payee;
      if (!expectedDestination) return;
      const isFiring = destination !== expectedDestination;
      const message = this.fmt.message(
        [
          `Unexpected reward destination detected for ${this.fmt.accountLink(account.name, account.ss58)}`,
          `Expected "${expectedDestination}", got "${destination}"`,
        ],
        blockContext,
      );
      const key = { account: account.ss58, groupId, handlerType };
      await this.incidents.handle(message, notifications, key, blockContext, isFiring);
    });
  }

  @State(H.ActiveSetPresenceState, [Chain.Polkadot, Chain.Kusama])
  async activeSetPresense({ blockContext, handlerType }: StateHandlerParams<H.ActiveSetPresenceState>): Promise<void> {
    const validators = await this.chain.sessionValidators(blockContext.blockNumber);

    await this.reg.forEachAccount(handlerType, async ({ account, notifications, groupId }) => {
      const isFiring = !validators[account.ss58];
      const message = this.fmt.message(
        [`Target ${this.fmt.accountLink(account.name, account.ss58)} is not present in the validation active set`],
        blockContext,
      );
      const key = { account: account.ss58, groupId, handlerType };
      await this.incidents.handle(message, notifications, key, blockContext, isFiring);
    });
  }
}
