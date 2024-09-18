import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';

import { ProcessedBlockModule } from './block-tracker/block-tracker.module';
import { AppService } from './app.service';
import { ChainWatcherConfigService } from './config-services/chain-watcher-config.service';
import { AppConfigService } from './config-services/app-config.service';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ProcessedBlockModule,
  ],
  providers: [
    Logger,
    AppService,
    ChainWatcherConfigService,
    AppConfigService
  ],
})
export class AppModule {}
