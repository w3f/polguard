import { EventHandler, EveryBlockHandler } from '../../decorators';
import {
  IdentityHandlerType as H,
  EveryBlockHandlerParams,
  MonitorType,
  Chain,
  EventHandlerParams,
  IDENTITY_FIELDS,
} from '@w3f/monitoring-types';
import { AbstractMonitor } from '../abstract-monitor';

export class IdentityMonitor extends AbstractMonitor<MonitorType.Identity> {
  @EveryBlockHandler([Chain.PeoplePolkadot, Chain.PeopleKusama])
  async identityUnexpected({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const addressToParent = await this.getAddressToParent(blockNumber);
    const parents = Array.from(new Set(addressToParent.values()));
    const identities = await this.stateQuery.identityOf(parents, blockNumber);

    for (const address of this.uniqueAddresses) {
      const parent = addressToParent.get(address);
      const identity = identities[parent];

      for (const { account, alerts, groupId } of this.getAccounts(H.IdentityUnexpected, address)) {
        const mismatchedFields = IDENTITY_FIELDS.filter(field => {
          const expectedValue = account.settings[field];
          if (!expectedValue) return false;
          return expectedValue !== identity?.[field];
        });

        const isFiring = mismatchedFields.length > 0;
        const messageLines = [`Unexpected identity fields detected for ${this.formatAccountLink(account)}.`];

        mismatchedFields.forEach(field => {
          messageLines.push(`${field}: expected "${account.settings[field]}", got "${identity?.[field] ?? 'Not set'}"`);
        });

        const message = this.createMessage(messageLines, { blockNumber });

        const key = `${account.ss58}:${groupId}:${H.IdentityUnexpected}`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }

  @EventHandler(
    ['identity.IdentitySet', 'identity.IdentityCleared', 'identity.IdentityKilled'],
    [Chain.PeoplePolkadot, Chain.PeopleKusama],
  )
  async identityChanged({ eventRecord, blockNumber }: EventHandlerParams): Promise<void> {
    const parent = eventRecord.event.data[0].toString();
    const addressToParent = await this.getAddressToParent(blockNumber);
    const address = this.findAddressByParent(parent, addressToParent);

    if (!address) return;

    for (const { account, alerts } of this.getAccounts(H.IdentityChanged, address)) {
      const previousIdentity = await this.stateQuery.identityOf([parent], blockNumber - 1);
      const currentIdentity = await this.stateQuery.identityOf([parent], blockNumber);
      const previous = previousIdentity[parent];
      const current = currentIdentity[parent];

      const messageLines = [`Identity change detected for ${this.formatAccountLink(account)}.`];

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

      const message = this.createMessage(messageLines, {
        blockNumber,
        phase: eventRecord.phase,
      });

      await this.incidents.oneTimeIncident(message, alerts, blockNumber);
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
    const superOf = await this.stateQuery.identitySuperOf(this.uniqueAddresses, blockNumber);
    const mapping = new Map<string, string>();
    
    this.uniqueAddresses.forEach(address => {
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
