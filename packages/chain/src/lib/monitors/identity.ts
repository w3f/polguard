import { Event, State } from '../decorators';
import {
  IdentityHandlerType as H,
  MonitorType,
  Chain,
  EventHandlerParams,
  IDENTITY_FIELDS,
} from '../../types';
import { AbstractMonitor } from './abstract-monitor';

export class IdentityMonitor extends AbstractMonitor<MonitorType.Identity> {
  @State(H.IdentityUnexpectedState, [Chain.PeoplePolkadot, Chain.PeopleKusama, Chain.PeoplePaseo])
  async identityUnexpected(): Promise<void> {
    const { blockNumber } = this.block;
    const addressToParent = await this.getAddressToParent(blockNumber);
    const parents = Array.from(new Set(addressToParent.values()));
    const identities = await this.chain.identityOf(parents, blockNumber);

    for (const a of this.watched()) {
      const identity = identities[addressToParent.get(a.ss58)];
      const mismatchedFields = IDENTITY_FIELDS.filter(field => {
        const expectedValue = a.settings[field];
        if (!expectedValue) return false;
        return expectedValue !== identity?.[field];
      });

      await a.track(
        'Unexpected identity fields',
        mismatchedFields.map(field => `${field}: expected "${a.settings[field]}", actual "${identity?.[field] ?? 'Not set'}"`),
        mismatchedFields.length > 0,
      );
    }
  }

  @Event(
    H.IdentityChangedEvent,
    [Chain.PeoplePolkadot, Chain.PeopleKusama, Chain.PeoplePaseo],
    ['identity.IdentitySet', 'identity.IdentityCleared', 'identity.IdentityKilled'],
  )
  async identityChanged({ payload }: EventHandlerParams<H.IdentityChangedEvent>): Promise<void> {
    const { blockNumber } = this.block;
    const parent = payload.who;
    const addressToParent = await this.getAddressToParent(blockNumber);
    const address = this.findAddressByParent(parent, addressToParent);

    if (!address) return;

    const [previousIdentity, currentIdentity] = await Promise.all([
      this.chain.identityOf([parent], blockNumber - 1),
      this.chain.identityOf([parent], blockNumber),
    ]);
    const previous = previousIdentity[parent];
    const current = currentIdentity[parent];

    const changedFields: string[] = [];
    IDENTITY_FIELDS.forEach(field => {
      const previousValue = previous?.[field] ?? 'Not set';
      const currentValue = current?.[field] ?? 'Not set';
      if (previousValue !== currentValue) {
        changedFields.push(`${field}: "${previousValue}" → "${currentValue}"`);
      }
    });

    // In case some other unknown field was changed.
    if (changedFields.length === 0) {
      changedFields.push('Identity updated (no specific changes detected)');
    }

    for (const a of this.matched(address)) await a.report('Identity changed', changedFields);
  }

  @State(H.IdentityMissingState, [Chain.PeoplePolkadot, Chain.PeopleKusama, Chain.PeoplePaseo])
  async identityMissing(): Promise<void> {
    const addressToParent = await this.getAddressToParent(this.block.blockNumber);
    const parents = Array.from(new Set(addressToParent.values()));
    const identities = await this.chain.identityOf(parents, this.block.blockNumber);

    for (const a of this.watched()) {
      const identity = identities[addressToParent.get(a.ss58)];
      await a.track('Identity missing', [], !identity);
    }
  }

  @State(H.IdentityFieldsMissingState, [Chain.PeoplePolkadot, Chain.PeopleKusama, Chain.PeoplePaseo])
  async identityFieldsMissing(): Promise<void> {
    // TODO: Make requiredFields configurable
    const requiredFields = ['email', 'matrix'];
    const addressToParent = await this.getAddressToParent(this.block.blockNumber);
    const parents = Array.from(new Set(addressToParent.values()));
    const identities = await this.chain.identityOf(parents, this.block.blockNumber);

    for (const a of this.watched()) {
      const identity = identities[addressToParent.get(a.ss58)];
      if (!identity) continue;

      const missingFields = requiredFields.filter(field => !identity[field]);
      await a.track(
        'Required identity fields missing',
        missingFields.map(field => `${field}: Not set`),
        missingFields.length > 0,
      );
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
