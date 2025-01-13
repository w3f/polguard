import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { IncidentEvent } from '@w3f/monitoring-types';

@Controller()
export class IncidentController {
  private logger: Logger = new Logger(IncidentController.name);

  constructor() {}

  @MessagePattern('incident.created')
  async handleIncidentEvent(event: IncidentEvent) {
    this.logger.log('Received incident created event');
  }

  @MessagePattern('incident.resolved')
  async handleIncidentResolvedEvent(event: IncidentEvent) {
    this.logger.log('Received incident resolved event');
  }

}
