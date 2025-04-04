import { Controller, Get, Logger, Query } from '@nestjs/common';
import { MonitoringConfigService } from './monitoring-config.service';
import { GetMonitoringGroupsDto, GetAccountsDto, MonitoringGroupsResponseDto, AccountsResponseDto } from './dto';

@Controller('monitoring-config')
export class MonitoringConfigController {
  private readonly logger = new Logger(MonitoringConfigController.name);

  constructor(private readonly monitoringConfigService: MonitoringConfigService) {}

  @Get('groups')
  getMonitoringGroups(@Query() query: GetMonitoringGroupsDto): MonitoringGroupsResponseDto {
    this.logger.debug(`Fetching monitoring groups for chain ${query.chain}: ${query.groupIds.join(', ')}`);
    return {
      groups: this.monitoringConfigService.getMonitoringGroups(query.chain, query.groupIds),
    };
  }

  @Get('accounts')
  getAccounts(@Query() query: GetAccountsDto): AccountsResponseDto {
    this.logger.debug(`Fetching accounts for chain ${query.chain}, groups: ${query.groupIds.join(', ')}`);
    return {
      accounts: this.monitoringConfigService.getAccounts(query.chain, query.groupIds),
    };
  }
}
