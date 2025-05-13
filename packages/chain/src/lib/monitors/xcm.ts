import '@polkadot/api-augment/polkadot';
import { Chain, MonitorType, XcmHandlerType as H, EventHandlerParams } from '@w3f/monitoring-types';
import { hexToU8a } from '@polkadot/util';
import { encodeAddress } from '@polkadot/util-crypto';
import { StagingXcmV4Location, StagingXcmV4Xcm, StagingXcmV4Asset } from '@polkadot/types/lookup';
import { Event } from '../decorators';
import { AbstractMonitor } from './abstract-monitor';

export class XcmMonitor extends AbstractMonitor<MonitorType.Xcm> {
  @Event(
    H.XcmTransferEgress,
    [Chain.Polkadot, Chain.Kusama, Chain.AssetHubPolkadot, Chain.AssetHubKusama],
    ['polkadotXcm.Sent', 'xcmPallet.Sent'],
  )
  async xcmTransferEgress({
    eventRecord,
    blockNumber,
    handlerType,
  }: EventHandlerParams<H.XcmTransferEgress>): Promise<void> {
    let transferInfo;

    try {
      const [rawOrigin, rawDestination, rawMessage] = eventRecord.event.data;
      transferInfo = this.extractXcmTransferInfo(rawOrigin, rawDestination, rawMessage, blockNumber);
    } catch (error) {
      this.logger.error(`Failed to process XCM transfer: ${error}`);
      throw error;
    }

    const { origin, destination, destinationChain, amount, _token } = transferInfo;

    if (!origin) {
      this.logger.warn(`Unable to determine origin address for XCM transfer in block ${blockNumber}`);
      return;
    }

    for (const { account, notifications, groupId } of this.reg.getAccounts(handlerType, origin)) {
      const message = this.fmt.message(
        [
          `${this.fmt.accountLink(account)} sent ${this.fmt.balance(amount)}`,
          `To: ${destination || 'Unknown'}`,
          `Destination chain: ${destinationChain || 'Unknown'}`,
        ],
        { blockNumber, phase: eventRecord.phase },
      );
      const key = { account: account.ss58, groupId, handlerType };
      await this.incidents.handle(message, notifications, key, blockNumber);
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
    amount?: string;
    token?: string;
  } {
    const origin = rawOrigin as unknown as StagingXcmV4Location;
    const destination = rawDestination as unknown as StagingXcmV4Location;
    const message = rawMessage as unknown as StagingXcmV4Xcm;

    // 1. Get origin from the MultiLocation (X1.AccountId32)
    const originAddress = this.getLocation(origin, blockNumber);

    // 2. Get beneficiary
    // 2.1. Try from "DepositAsset" instruction, which is common for most of extrinsics
    let beneficiaryInstruction = this.findInstruction(message, 'DepositAsset');
    let destinationLocation = destination;

    if (!beneficiaryInstruction) {
      // 2.2. Try from "DepositReserveAsset" instruction used by "transfer_assets_using_type_and_then"
      // Check custom XCM on destination
      const depositRA = this.findInstruction(message, 'DepositReserveAsset');
      if (depositRA?.xcm) {
        beneficiaryInstruction = this.findInstruction(depositRA.xcm, 'DepositAsset');
        // Real destination is in the nested XCM message
        destinationLocation = depositRA.dest;
      }
    }

    const destinationAddress = this.getLocation(beneficiaryInstruction?.beneficiary, blockNumber);

    // 3. Get assets information
    const assetInstruction =
      this.findInstruction(message, 'ReserveAssetDeposited') ||
      this.findInstruction(message, 'ReceiveTeleportedAsset') ||
      [];

    const destinationChain = this.getLocation(destinationLocation, blockNumber);
    const transfers = this.getTokenAmountFromAsset(assetInstruction, blockNumber);
    // TODO: AssetHub monitoring. The list of assets should be returned instead.
    const [token, amount] = transfers[0] || [undefined, undefined];

    return {
      origin: originAddress,
      destination: destinationAddress,
      destinationChain,
      amount,
      token,
    };
  }

  /**
   * Extracts location information from a MultiLocation
   */
  private getLocation(location: StagingXcmV4Location, blockNumber: number): string | undefined {
    if (!location || !location.interior) {
      this.logger.debug(`XCM. Instruction not supported or doesn't include asset transfer. Block ${blockNumber}`);
      return;
    } else if (!location.interior.isX1) {
      this.logger.debug(`XCM. Junctions not supported: ${location.interior.type}. Block ${blockNumber}`);
      return;
    }

    const x1 = location.interior.asX1[0];
    if (x1.isAccountId32) {
      const originIdHex = x1.asAccountId32.id.toString();
      // Use chain's SS58 format
      return encodeAddress(hexToU8a(originIdHex), this.chainProps.ss58Format);
    } else if (x1.isAccountKey20) {
      return String(x1.asAccountKey20.key.toHuman());
    } else if (x1.isParachain) {
      const chainIndex = x1.asParachain.toString();
      // TODO: Use parachainNames from types.constants. If it's AssetHubPolkadot, how to get information about relay chain name?
      return `Parachain ${chainIndex}`;
    } else {
      this.logger.debug(`XCM. Junctions not supported: ${x1.type}. Block ${blockNumber}`);
    }

    return;
  }

  /**
   * Finds an instruction in an XCM message
   */
  private findInstruction(xcm: StagingXcmV4Xcm, key: string) {
    return xcm.find((instr: any) => instr.type === key)?.[`as${key}`];
  }

  /**
   * Extracts token and amount information from assets
   */
  private getTokenAmountFromAsset(
    assets: StagingXcmV4Asset[],
    blockNumber: number,
  ): [string | undefined, string | undefined][] {
    const result: [string | undefined, string | undefined][] = [];

    for (const asset of assets) {
      if (!asset.fun?.isFungible) {
        // NFTs are not a subject for monitoring
        continue;
      }
      const amount = asset.fun.asFungible.toString();
      const interior = asset.id?.interior;
      let token: string | undefined;

      if (!interior) {
        continue;
      }

      if (interior.isHere) {
        // Use chain token from chain properties
        token = this.chainProps.chainToken;
      } else if (interior.isX3) {
        // TODO: AssetHub monitoring. The token address should be processed.
        this.logger.debug(`AssetHub token detected but not yet supported. Block ${blockNumber}`);
        continue;
      } else {
        this.logger.debug(`Asset Junctions not supported: ${interior.type}. Block ${blockNumber}`);
        continue;
      }

      result.push([token, amount]);
    }

    return result;
  }
}
