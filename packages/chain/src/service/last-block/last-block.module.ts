import { Logger, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LastBlockService } from './last-block.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [Logger, LastBlockService],
  exports: [LastBlockService],
})
export class LastBlockModule {
  static forRootAsync() {
    return {
      module: LastBlockModule,
      imports: [HttpModule, ConfigModule],
      providers: [Logger, LastBlockService],
      exports: [LastBlockService],
    };
  }
}
