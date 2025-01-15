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
    const identities = await this.stateQuery.identityOf(this.uniqueAddresses, blockNumber);
    for (const address of this.uniqueAddresses) {
      const identity = identities[address];

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

        const key = `${account.ss58}:${groupId}:identityUnexpected`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }

  @EventHandler(
    ['identity.IdentitySet', 'identity.IdentityCleared', 'identity.IdentityKilled'],
    [Chain.PeoplePolkadot, Chain.PeopleKusama],
  )
  async identityChanged({ eventRecord, blockNumber }: EventHandlerParams): Promise<void> {
    const who = eventRecord.event.data[0].toString();

    for (const { account, alerts } of this.getAccounts(H.IdentityChanged, who)) {
      const previousIdentity = await this.stateQuery.identityOf([who], blockNumber - 1);
      const currentIdentity = await this.stateQuery.identityOf([who], blockNumber);
      const previous = previousIdentity[who];
      const current = currentIdentity[who];

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
}
