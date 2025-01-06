import { EveryBlockHandler } from '../../decorators';
import { IdentityHandlerType as H, EveryBlockHandlerParams, MonitorType, Chain } from '@w3f/monitoring-types';
import { AbstractMonitor } from '../abstract-monitor';

export class IdentityMonitor extends AbstractMonitor<MonitorType.Identity> {
  // TODO: that's a draft implementation
  @EveryBlockHandler([Chain.PeoplePolkadot, Chain.PeopleKusama])
  async identityUnexpected({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const identities = await this.stateQuery.identityOf(this.uniqueAddresses, blockNumber);
    for (let i = 0; i < this.uniqueAddresses.length; i++) {
      const address = this.uniqueAddresses[i];
      const identity = identities[address];
      for (const { account, alerts, groupId } of this.getAccounts(H.IdentityUnexpected, address)) {
        if (!(account.settings.riot && account.settings.email)) continue;
        
        // TODO: if more checks, refactor
        const isRiotFiring = account.settings.riot && account.settings.riot !== identity.riot;
        const isEmailFiring = account.settings.email && account.settings.email !== identity.email;
        const isFiring = isRiotFiring || isEmailFiring;

        const message = this.createMessage(
          [
            `Unexpected identity fields detected for ${this.formatAccountLink(account)}.`,
            `Riot: expected "${account.settings.riot ?? 'Not set'}", got "${identity?.riot ?? 'Not set'}"`,
            `Email: expected "${account.settings.email ?? 'Not set'}", got "${identity?.email ?? 'Not set'}"`,
          ],
          { blockNumber },
        );

        const key = `${account.ss58}:${groupId}:identityUnexpected`;
        await this.incidents.ongoingIncident(message, alerts, blockNumber, key, isFiring);
      }
    }
  }
}
