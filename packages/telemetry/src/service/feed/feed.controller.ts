import { Controller, Get } from '@nestjs/common';
import { Chain } from '@w3f/monitoring-types';
import { NodeInfo } from '@w3f/substrate-telemetry-client';
import { TelemetryService } from '../telemetry/telemetry.service';

@Controller('feed')
export class FeedController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Get()
  async getFeed(): Promise<{ polkadot: NodeInfo[]; kusama: NodeInfo[] }> {
    const [polkadot, kusama] = await Promise.all([
      this.telemetryService.getNodeStates(Chain.Polkadot),
      this.telemetryService.getNodeStates(Chain.Kusama),
    ]);

    return {
      polkadot,
      kusama,
    };
  }
}
