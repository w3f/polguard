import { Controller, Get, Post, Body, Param, BadRequestException, Logger } from '@nestjs/common';
import { LastBlockService } from './last-block.service';
import { Chain } from '@w3f/monitoring-common';
import { SetLastBlockDto } from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { LastBlock } from '../database/last-block.entity';

@ApiTags('last-block')
@Controller('last-block')
export class LastBlockController {
  private readonly logger = new Logger(LastBlockController.name);

  constructor(private readonly lastBlockService: LastBlockService) {}

  @Get(':chain')
  @ApiOperation({ summary: 'Get the last processed block for a chain' })
  @ApiResponse({ status: 200, description: 'The last processed block', type: LastBlock })
  @ApiResponse({ status: 400, description: 'Invalid chain parameter' })
  @ApiParam({ name: 'chain', enum: Chain })
  async getLastBlock(@Param('chain') chain: string): Promise<LastBlock | null> {
    this.logger.debug(`Getting last block for chain: ${chain}.`);
    if (!Object.values(Chain).includes(chain as Chain)) {
      throw new BadRequestException(`Invalid chain parameter: ${chain}`);
    }
    const lastBlock = await this.lastBlockService.getLastBlock(chain as Chain);
    this.logger.debug(`Last block for chain ${chain} is ${lastBlock?.blockNumber}.`);
    return lastBlock;
  }

  @Post()
  @ApiOperation({ summary: 'Set the last processed block for a chain' })
  @ApiResponse({ status: 201, description: 'The block was updated' })
  @ApiResponse({ status: 409, description: 'Block already processed' })
  async setLastBlock(@Body() setLastBlockDto: SetLastBlockDto): Promise<void> {
    this.logger.debug(`Setting last block for chain: ${setLastBlockDto.chain}, block: ${setLastBlockDto.blockNumber}.`);
    return this.lastBlockService.setLastBlock(setLastBlockDto.chain, setLastBlockDto.blockNumber);
  }
}
