import { EveryBlockHandler } from '../../decorators';
import { IdentityHandlerType as H, EveryBlockHandlerParams, MonitorType, Chain } from '@w3f/monitoring-types';
import { AbstractMonitor } from '../abstract-monitor';

export class IdentityMonitor extends AbstractMonitor<MonitorType.Identity> {
  // TODO: Add event handler
  @EveryBlockHandler([Chain.PeoplePolkadot, Chain.PeopleKusama])
  async identityUnexpected({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    const identities = await this.stateQuery.identityOf(this.uniqueAddresses, blockNumber);
    for (const address of this.uniqueAddresses) {
      const identity = identities[address];

      for (const { account, alerts, groupId } of this.getAccounts(H.IdentityUnexpected, address)) {
        if (!(account.settings.matrix && account.settings.email)) continue;

        // TODO: if more checks, refactor
        const isMatrixFiring = account.settings.matrix && account.settings.matrix !== identity.matrix;
        const isEmailFiring = account.settings.email && account.settings.email !== identity.email;
        const isFiring = isMatrixFiring || isEmailFiring;

        const message = this.createMessage(
          [
            `Unexpected identity fields detected for ${this.formatAccountLink(account)}.`,
            `Matrix: expected "${account.settings.matrix ?? 'Not set'}", got "${identity?.matrix ?? 'Not set'}"`,
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
