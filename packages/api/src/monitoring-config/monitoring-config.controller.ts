import { Controller, Get, Logger, Query } from '@nestjs/common';
import { MonitoringConfigService } from './monitoring-config.service';
import { GetConfigDto, MonitoringGroupsResponseDto, AccountsResponseDto } from './dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('monitoring-config')
@Controller('monitoring-config')
export class MonitoringConfigController {
  private readonly logger = new Logger(MonitoringConfigController.name);

  constructor(private readonly monitoringConfigService: MonitoringConfigService) {}

  @Get('groups')
  @ApiOperation({
    summary: 'Get monitoring groups for a chain',
    description: 'Retrieve monitoring groups for a specific blockchain network.',
  })
  @ApiResponse({ status: 200, type: MonitoringGroupsResponseDto })
  getMonitoringGroups(@Query() query: GetConfigDto): MonitoringGroupsResponseDto {
    const groupIdsLog = query.groupIds.length > 0 ? query.groupIds.join(', ') : 'all groups';
    this.logger.debug(`Fetching monitoring groups for chain ${query.chain}: ${groupIdsLog}`);
    return {
      groups: this.monitoringConfigService.getMonitoringGroups(query.chain, query.groupIds),
    };
  }

  @Get('accounts')
  @ApiOperation({
    summary: 'Get accounts for monitoring',
    description: 'Retrieve accounts configured for monitoring for a specific blockchain network.',
  })
  @ApiResponse({ status: 200, type: AccountsResponseDto })
  getAccounts(@Query() query: GetConfigDto): AccountsResponseDto {
    const groupIdsLog = query.groupIds.length > 0 ? query.groupIds.join(', ') : 'all groups';
    this.logger.debug(`Fetching accounts for chain ${query.chain}, groups: ${groupIdsLog}`);
    return {
      accounts: this.monitoringConfigService.getAccounts(query.chain, query.groupIds),
    };
  }
}
