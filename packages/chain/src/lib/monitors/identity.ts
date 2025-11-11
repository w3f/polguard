import { Event, State } from '../decorators';
import {
  IdentityHandlerType as H,
  StateHandlerParams,
  MonitorType,
  Chain,
  EventHandlerParams,
  IDENTITY_FIELDS,
} from '@w3f/monitoring-common';
import { AbstractMonitor } from './abstract-monitor';

export class IdentityMonitor extends AbstractMonitor<MonitorType.Identity> {
  @State(H.IdentityUnexpectedState, [Chain.PeoplePolkadot, Chain.PeopleKusama, Chain.PeoplePaseo])
  async identityUnexpected({
    blockContext,
    handlerType,
  }: StateHandlerParams<H.IdentityUnexpectedState>): Promise<void> {
    const { blockNumber } = blockContext;
    const addressToParent = await this.getAddressToParent(blockNumber);
    const parents = Array.from(new Set(addressToParent.values()));
    const identities = await this.chain.identityOf(parents, blockNumber);

    for (const address of this.reg.getUniqueAddresses()) {
      const parent = addressToParent.get(address);
      const identity = identities[parent];

      for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, address)) {
        const mismatchedFields = IDENTITY_FIELDS.filter(field => {
          const expectedValue = account.settings[field];
          if (!expectedValue) return false;
          return expectedValue !== identity?.[field];
        });

        const messageLines = [
          `Unexpected identity fields detected for ${this.fmt.accountLink(account.name, account.ss58)}`,
        ];

        mismatchedFields.forEach(field => {
          messageLines.push(`${field}: expected "${account.settings[field]}", got "${identity?.[field] ?? 'Not set'}"`);
        });

        const message = this.fmt.message(messageLines, blockContext);
        const key = { account: account.ss58, groupId, handlerType };
        const isFiring = mismatchedFields.length > 0;
        await this.incidents.handle(message, notifications, key, blockContext, isFiring);
      }
    }
  }

  @Event(
    H.IdentityChangedEvent,
    [Chain.PeoplePolkadot, Chain.PeopleKusama, Chain.PeoplePaseo],
    ['identity.IdentitySet', 'identity.IdentityCleared', 'identity.IdentityKilled'],
  )
  async identityChanged({
    eventRecord,
    blockContext,
    handlerType,
  }: EventHandlerParams<H.IdentityChangedEvent>): Promise<void> {
    const { blockNumber } = blockContext;
    const parent = eventRecord.event.data[0].toString();
    const addressToParent = await this.getAddressToParent(blockNumber);
    const address = this.findAddressByParent(parent, addressToParent);

    if (!address) return;

    for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, address)) {
      const previousIdentity = await this.chain.identityOf([parent], blockNumber - 1);
      const currentIdentity = await this.chain.identityOf([parent], blockNumber);
      const previous = previousIdentity[parent];
      const current = currentIdentity[parent];

      const messageLines = [`Identity change detected for ${this.fmt.accountLink(account.name, account.ss58)}`];

      IDENTITY_FIELDS.forEach(field => {
        const previousValue = previous?.[field] ?? 'Not set';
        const currentValue = current?.[field] ?? 'Not set';

        if (previousValue !== currentValue) {
          messageLines.push(`${field}: "${previousValue}" → "${currentValue}"`);
        }
      });

      // In case some other unknown field was changed.
      if (messageLines.length === 1) {
        messageLines.push('Identity was updated but no specific changes were detected');
      }

      const message = this.fmt.message(messageLines, blockContext);
      const key = { account: account.ss58, groupId, handlerType };
      await this.incidents.handle(message, notifications, key, blockContext);
    }
  }

  @State(H.IdentityMissingState, [Chain.PeoplePolkadot, Chain.PeopleKusama, Chain.PeoplePaseo])
  async identityMissing({ blockContext, handlerType }: StateHandlerParams<H.IdentityMissingState>): Promise<void> {
    const addressToParent = await this.getAddressToParent(blockContext.blockNumber);
    const parents = Array.from(new Set(addressToParent.values()));
    const identities = await this.chain.identityOf(parents, blockContext.blockNumber);

    for (const address of this.reg.getUniqueAddresses()) {
      const parent = addressToParent.get(address);
      const identity = identities[parent];

      for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, address)) {
        const messageLines = [`Identity is missing for ${this.fmt.accountLink(account.name, account.ss58)}`];
        const message = this.fmt.message(messageLines, blockContext);
        const key = { account: account.ss58, groupId, handlerType };
        const isFiring = !identity;
        await this.incidents.handle(message, notifications, key, blockContext, isFiring);
      }
    }
  }

  @State(H.IdentityFieldsMissingState, [Chain.PeoplePolkadot, Chain.PeopleKusama, Chain.PeoplePaseo])
  async identityFieldsMissing({
    blockContext,
    handlerType,
  }: StateHandlerParams<H.IdentityFieldsMissingState>): Promise<void> {
    // TODO: Make requiredFields configurable
    const requiredFields = ['email', 'matrix'];
    const addressToParent = await this.getAddressToParent(blockContext.blockNumber);
    const parents = Array.from(new Set(addressToParent.values()));
    const identities = await this.chain.identityOf(parents, blockContext.blockNumber);

    for (const address of this.reg.getUniqueAddresses()) {
      const parent = addressToParent.get(address);
      const identity = identities[parent];
      if (!identity) continue;

      for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, address)) {
        const missingFields = requiredFields.filter(field => !identity[field]);
        const messageLines = [
          `Required identity fields missing for ${this.fmt.accountLink(account.name, account.ss58)}`,
          ...missingFields.map(field => `${field}: Not set`),
        ];
        const message = this.fmt.message(messageLines, blockContext);
        const key = { account: account.ss58, groupId, handlerType };
        const isFiring = missingFields.length > 0;
        await this.incidents.handle(message, notifications, key, blockContext, isFiring);
      }
    }
  }

  /**
   * The monitor receives a list of addresses to watch, but some accounts operate as sub-identities.
   * In such cases, the identity information is stored under the parent account, not under the monitored address.
   * This function creates a mapping from input addresses to their identity holders:
   * - For regular identities: address -> address (self-mapping)
   * - For sub-identities: address -> parent address
   * This mapping is then used to correctly fetch and check identity information.
   */
  private async getAddressToParent(blockNumber: number): Promise<Map<string, string>> {
    const addresses = this.reg.getUniqueAddresses();
    const superOf = await this.chain.identitySuperOf(addresses, blockNumber);
    const mapping = new Map<string, string>();

    addresses.forEach(address => {
      mapping.set(address, superOf[address] || address);
    });

    return mapping;
  }

  private findAddressByParent(parent: string, mapping: Map<string, string>): string | undefined {
    for (const [address, parentAddress] of mapping) {
      if (parentAddress === parent) {
        return address;
      }
    }
    return undefined;
  }
}
