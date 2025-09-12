import '@polkadot/api-augment/polkadot';
import {
  Chain,
  MonitorType,
  XcmHandlerType as H,
  EventHandlerParams,
  ID_TOKEN_MAP,
  PARACHAIN_NAMES,
} from '@w3f/monitoring-types';
import { hexToU8a } from '@polkadot/util';
import { encodeAddress } from '@polkadot/util-crypto';
import { StagingXcmV4Location, StagingXcmV4Xcm, StagingXcmV4Asset } from '@polkadot/types/lookup';
import { Event } from '../decorators';
import { AbstractMonitor } from './abstract-monitor';

export class XcmMonitor extends AbstractMonitor<MonitorType.Xcm> {
  @Event(
    H.XcmTransferEgressEvent,
    [Chain.Polkadot, Chain.Kusama, Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo],
    ['polkadotXcm.Sent', 'xcmPallet.Sent'],
  )
  async xcmTransferEgress({
    eventRecord,
    blockContext,
    handlerType,
  }: EventHandlerParams<H.XcmTransferEgressEvent>): Promise<void> {
    const [rawOrigin, rawDestination, rawMessage] = eventRecord.event.data;
    const transferInfo = this.extractXcmTransferInfo(rawOrigin, rawDestination, rawMessage, blockContext.blockNumber);
    const { origin, destination, destinationChain, transfers } = transferInfo;

    if (!origin) {
      return;
    }

    for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, origin)) {
      for (const [token, amount] of transfers) {
        const messageLines = [];

        if (token !== undefined && amount !== undefined) {
          const formattedBalance =
            token === this.chainProps.chainToken ? this.fmt.balance(amount) : this.fmt.balance(amount, token);

          messageLines.push(`${this.fmt.accountLink(account.name, account.ss58)} sent ${formattedBalance}`);
        } else {
          messageLines.push(`${this.fmt.accountLink(account.name, account.ss58)} sent XCM transfer`);
        }

        messageLines.push(`To: ${destination ?? 'Unknown'}`, `Destination chain: ${destinationChain ?? 'Unknown'}`);

        const message = this.fmt.message(messageLines, blockContext);

        const key = { account: account.ss58, groupId, handlerType };
        await this.incidents.handle(message, notifications, key, blockContext);
      }
    }
  }

  private extractXcmTransferInfo(
    rawOrigin: unknown,
    rawDestination: unknown,
    rawMessage: unknown,
    blockNumber: number,
  ): {
    origin?: string;
    destination?: string;
    destinationChain?: string;
    transfers: [string | undefined, string | undefined][];
  } {
    const originLoc = rawOrigin as unknown as StagingXcmV4Location;
    const destinationLoc = rawDestination as unknown as StagingXcmV4Location;
    const message = rawMessage as unknown as StagingXcmV4Xcm;

    // 1. Get origin account from the MultiLocation
    // Origin is not always X1.AccountId32, can be chain itself MultiLocation::Here, e.g. https://polkadot.subscan.io/block/26472907
    const origin = this.parseLocation(originLoc, blockNumber);

    // 2. Determine beneficiary instruction (handles nested XCM cases)
    let beneficiaryInstr = this.findInstruction(message, 'DepositAsset');
    let destLoc = destinationLoc;

    if (!beneficiaryInstr) {
      // 2.2. Fallback: DepositReserveAsset may wrap a nested DepositAsset
      const depositRA = this.findInstruction(message, 'DepositReserveAsset');
      if (depositRA?.xcm) {
        beneficiaryInstr = this.findInstruction(depositRA.xcm, 'DepositAsset');
        destLoc = depositRA.dest;
      }
    }

    // 2.3. Decode beneficiary account and destination chain
    const destination = this.parseLocation(beneficiaryInstr?.beneficiary, blockNumber);
    const destinationChain = this.parseLocation(destLoc, blockNumber);

    // 3. Get assets instructions for either ReserveAssetDeposited or ReceiveTeleportedAsset
    const assetInst =
      this.findInstruction(message, 'ReserveAssetDeposited') ||
      this.findInstruction(message, 'ReceiveTeleportedAsset') ||
      [];

    let transfers = this.getTokenAmountFromAsset(assetInst, blockNumber);
    if (!transfers.length) {
      transfers = [[undefined, undefined]];
    }

    return { origin, destination, destinationChain, transfers };
  }

  /**
   * Extracts an account ID or parachain label from a MultiLocation X1 junction
   */
  private parseLocation(location: StagingXcmV4Location | undefined, blockNumber: number): string | undefined {
    // Restricting to X1 junctions ignores composite paths like X2(Parachain, AccountId32) or deeper stacks
    // (e.g., teleporting via intermediate routers). So the destination will be Unknown, which is fine for now.
    if (!location?.interior || !location.interior.isX1) {
      this.logger.debug(`XCM. Unsupported junction or missing: ${location?.interior?.type} at block ${blockNumber}`);
      return;
    }

    const x1 = location.interior.asX1[0];
    if (x1.isAccountId32) {
      const hex = x1.asAccountId32.id.toString();
      return encodeAddress(hexToU8a(hex), this.chainProps.ss58Format);
    } else if (x1.isAccountKey20) {
      return String(x1.asAccountKey20.key.toHuman());
    } else if (x1.isParachain) {
      const id = x1.asParachain.toString();
      const relayMap =
        this.chainProps.chainToken === 'DOT' ? PARACHAIN_NAMES[Chain.Polkadot] : PARACHAIN_NAMES[Chain.Kusama];
      return relayMap[id] ?? `Parachain ${id}`;
    }

    this.logger.debug(`XCM. Unsupported junction type ${x1.type} at block ${blockNumber}`);
    return;
  }

  /**
   * Finds an instruction in an XCM message by type
   */
  private findInstruction(xcm: StagingXcmV4Xcm, key: string) {
    return xcm.find((instr: any) => instr.type === key)?.[`as${key}`];
  }

  /**
   * Extracts token and amount information from a list of XCM MultiAsset items
   */
  private getTokenAmountFromAsset(
    assets: StagingXcmV4Asset[],
    blockNumber: number,
  ): [string | undefined, string | undefined][] {
    const result: [string, string][] = [];
    const map = ID_TOKEN_MAP[this.chainProps.chain];
    for (const asset of assets) {
      // Skip non-fungible (e.g., NFT) assets
      if (!asset.fun?.isFungible) continue;
      const amount = asset.fun.asFungible.toString();

      const loc = asset.id as StagingXcmV4Location;
      let token: string | undefined;

      if (loc.interior.isHere) {
        token = this.chainProps.chainToken;
      } else if (loc.interior.isX3) {
        const idStr = loc.interior.asX3[2].asGeneralIndex.toString();
        token = map[idStr] ?? idStr;
      }

      if (!token) {
        this.logger.debug(`Unknown XCM asset ID ${asset.id.toString()} at block ${blockNumber}`);
        continue;
      }

      result.push([token, amount]);
    }

    return result;
  }
}
