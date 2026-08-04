import { NotificationSettings } from './incident';
import { AccountId } from './account';
import { Chain } from './constants';

export interface PayoutOperation {
  signer?: string;
  notifications?: NotificationSettings;
}

export interface Operations {
  payout?: PayoutOperation;
}

export interface PayoutAccount extends AccountId {
  chain: Chain;
  group: string;
  signer: string;
  notifications?: NotificationSettings;
}
