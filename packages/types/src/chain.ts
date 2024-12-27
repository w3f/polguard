import { Chain } from "./constants";

export interface ChainProperties {
  chain: Chain
  specName: string;
  chainDecimals: number;
  chainToken: string;
  ss58Format: number;
}
