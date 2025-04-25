import {
  AccountSettings,
  NotificationSettings,
  ConfigAccountSettings,
  MonitorHandlerType,
  MonitoringGroup,
  MonitorSettings,
  MonitorType,
} from '@w3f/monitoring-types';

type AccountConfig<T extends MonitorType> = {
  account: AccountSettings<T>;
  notifications: NotificationSettings;
  groupId: string;
};

export class AccountRegistry<T extends MonitorType> {
  private accounts: Map<string, AccountConfig<T>[]> = new Map();
  private uniqueAddresses: string[];

  constructor(
    private groups: MonitoringGroup[],
    private monitorType: T,
  ) {
    this.buildAccountLookup();
    this.uniqueAddresses = Array.from(this.accounts.keys());
  }

  /**
   * Builds account lookup structure for the monitor.
   *
   * This method processes all accounts from the monitoring groups and creates a lookup map
   * that maps ss58 addresses to arrays of account configurations. Multiple configurations
   * for the same address are possible when the same account is monitored by different groups
   * with different settings.
   *
   * Example:
   * {
   *   "5GrwvaEF...": [
   *     {
   *       account: { ss58: "5GrwvaEF...", name: "Alice", ... },
   *       notifications: { channels: ["room1"], ... },
   *       groupId: "validators-1"
   *     },
   *     {
   *       account: { ss58: "5GrwvaEF...", name: "Alice", ... },
   *       notifications: { channels: ["room2"], ... },
   *       groupId: "validators-2"
   *     }
   *   ]
   * }
   *
   * Using Map for O(1) address lookups.
   */
  private buildAccountLookup(): void {
    for (const group of this.groups) {
      for (const account of group.accounts as ConfigAccountSettings[]) {
        if (!this.accounts.has(account.ss58)) {
          this.accounts.set(account.ss58, []);
        }
        this.accounts.get(account.ss58).push({
          account: {
            ss58: account.ss58,
            hex: account.hex,
            name: account.name,
            settings: account[this.monitorType] as MonitorSettings<T>,
          },
          notifications: group.notifications,
          groupId: group.id,
        });
      }
    }
  }

  /**
   * Gets account configurations filtered by handler eligibility.
   *
   * Each address can have multiple account configurations when same account is monitored
   * by different groups with different settings. This method filters account configurations
   * based on handler configuration:
   *
   * - Only configurations that include the handler in their handlers array are returned
   *
   * @param handlerType - Handler type to check eligibility for
   * @param address - Account address to get configurations for
   * @returns Array of account configurations that are eligible for the handler
   */
  getAccounts(handlerType: MonitorHandlerType[T], address: string): AccountConfig<T>[] {
    const accounts = this.accounts.get(address) || [];

    return accounts.filter(account => {
      const handlers = account.account.settings.handlers as MonitorHandlerType[T][];
      return handlers.includes(handlerType);
    });
  }

  /**
   * Helper method to iterate through all accounts for a given handler type.
   * Simplifies common pattern of iterating through unique addresses and their accounts.
   *
   * @param handlerType - Type of handler to get accounts for
   * @param callback - Function to execute for each account
   */
  async forEachAccount(
    handlerType: MonitorHandlerType[T],
    callback: (params: {
      account: AccountSettings<T>;
      notifications: NotificationSettings;
      groupId: string;
    }) => Promise<void>,
  ): Promise<void> {
    for (const address of this.uniqueAddresses) {
      for (const accountInfo of this.getAccounts(handlerType, address)) {
        await callback(accountInfo);
      }
    }
  }

  /**
   * Gets all unique addresses in the registry.
   *
   * @returns Array of unique addresses
   */
  getUniqueAddresses(): string[] {
    return this.uniqueAddresses;
  }
}
