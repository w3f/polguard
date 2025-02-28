import { Controller, Get } from '@nestjs/common';
import { WatcherService } from '../watcher/watcher.service';
import { ActiveIncidentState } from '@w3f/monitoring-types';

@Controller('incidents')
export class IncidentController {
  constructor(private readonly watcherService: WatcherService) {}

  @Get('ongoing')
  async getOngoingIncidents(): Promise<ActiveIncidentState[]> {
    return this.watcherService.getAllOngoingIncidents();
  }
}
