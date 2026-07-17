import { encodeAddress } from '../utils';
import {
  Chain,
  MonitorType,
  XcmHandlerType as H,
  EventHandlerParams,
  ID_TOKEN_MAP,
  PARACHAIN_NAMES,
} from '../../types';
import { Event } from '../decorators';
import { AbstractMonitor } from './abstract-monitor';

/**
 * PAPI junction representation:
 * - X1: value is a single XcmJunction object (not an array)
 * - X2-X8: value is an array of XcmJunction objects
 * - Here: no value property
 */
type XcmLocation = { parents: number; interior: XcmJunctions };
type XcmJunctions = { type: string; value?: XcmJunction | XcmJunction[] };
type XcmJunction = { type: string; value: any };
type XcmInstruction = { type: string; value: any };
type XcmAsset = { id: XcmLocation; fun: { type: string; value: any } };

export class XcmMonitor extends AbstractMonitor<MonitorType.Xcm> {
  @Event(
    H.XcmTransferEgressEvent,
    [Chain.AssetHubPolkadot, Chain.AssetHubKusama, Chain.AssetHubPaseo],
    ['polkadotxcm.Sent', 'xcmpallet.Sent'],
  )
  async xcmTransferEgress({ payload }: EventHandlerParams<H.XcmTransferEgressEvent>): Promise<void> {
    const { origin, destination, message } = payload;
    const transferInfo = this.extractXcmTransferInfo(origin, destination, message, this.block.blockNumber);
    const { origin: originAddr, destination: destAddr, destinationChain, transfers } = transferInfo;

    if (!originAddr) {
      return;
    }

    for (const a of this.matched(originAddr)) {
      for (const [token, amount] of transfers) {
        const condition =
          token !== undefined && amount !== undefined
            ? `Sent ${token === this.chainProps.chainToken ? this.balance(amount) : this.balance(amount, token)}`
            : 'Sent XCM transfer';

        await a.report(condition, [
          `To: ${destAddr ?? 'Unknown'}`,
          `Destination chain: ${destinationChain ?? 'Unknown'}`,
        ]);
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
    const originLoc = rawOrigin as XcmLocation;
    const destinationLoc = rawDestination as XcmLocation;
    const message = rawMessage as XcmInstruction[];

    // 1. Get origin account from the Location
    // Origin is not always X1.AccountId32, can be chain itself Location::Here, e.g. https://polkadot.subscan.io/block/26472907
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
   * Extracts an account ID or parachain label from a Location's X1 junction
   */
  private parseLocation(location: XcmLocation | undefined, blockNumber: number): string | undefined {
    // Restricting to X1 junctions ignores composite paths like X2(Parachain, AccountId32) or deeper stacks
    // (e.g., teleporting via intermediate routers). So the destination will be Unknown, which is fine for now.
    if (!location?.interior || location.interior.type !== 'X1') {
      this.logger.debug(`XCM. Unsupported junction or missing: ${location?.interior?.type} at block ${blockNumber}`);
      return;
    }

    // X1 value is a single junction object, not an array (unlike X2-X8)
    const x1 = location.interior.value as XcmJunction;
    if (x1.type === 'AccountId32') {
      return encodeAddress(x1.value.id, this.chainProps.ss58Format);
    } else if (x1.type === 'AccountKey20') {
      return String(x1.value.key);
    } else if (x1.type === 'Parachain') {
      const id = String(x1.value);
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
  private findInstruction(xcm: XcmInstruction[], key: string): any | undefined {
    return xcm.find((instr: XcmInstruction) => instr.type === key)?.value;
  }

  /**
   * Extracts token and amount information from a list of XCM Asset items
   */
  private getTokenAmountFromAsset(assets: XcmAsset[], blockNumber: number): [string | undefined, string | undefined][] {
    const result: [string, string][] = [];
    const map = ID_TOKEN_MAP[this.chainProps.chain];
    for (const asset of assets) {
      // Skip non-fungible (e.g., NFT) assets
      if (asset.fun?.type !== 'Fungible') continue;
      const amount = String(asset.fun.value);

      const loc = asset.id as XcmLocation;
      let token: string | undefined;

      if (loc.interior.type === 'Here') {
        token = this.chainProps.chainToken;
      } else if (loc.interior.type === 'X3') {
        const junctions = loc.interior.value as XcmJunction[];
        const idStr = String(junctions[2].value);
        token = map[idStr] ?? idStr;
      }

      if (!token) {
        this.logger.debug(`Unknown XCM asset ID at block ${blockNumber}`);
        continue;
      }

      result.push([token, amount]);
    }

    return result;
  }
}
