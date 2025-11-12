import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LastBlockController } from './last-block.controller';
import { LastBlockService } from './last-block.service';
import { LastBlock } from '../database/last-block.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LastBlock])],
  controllers: [LastBlockController],
  providers: [LastBlockService],
  exports: [LastBlockService],
})
export class LastBlockModule {}
