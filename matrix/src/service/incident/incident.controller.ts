import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { IncidentEvent } from '@lib/interfaces';
import { MatrixClient } from '@lib/matrix-client';

@Controller()
export class IncidentController {
  private logger: Logger = new Logger(IncidentController.name);

  constructor(private matrixClient: MatrixClient) {}

  @MessagePattern('incident.created')
  async handleIncidentEvent(event: IncidentEvent) {
    this.logger.log('Received incident created event');
    await this.notifyMatrix(event);
  }

  @MessagePattern('incident.resolved')
  async handleIncidentResolvedEvent(event: IncidentEvent) {
    this.logger.log('Received incident resolved event');
    await this.notifyMatrix(event);
  }

  private async notifyMatrix(event: IncidentEvent) {
    event.alerts.matrix.targets.forEach(roomId => {
      this.matrixClient
        .sendMessage(roomId, event.message)
        .catch(error => this.logger.error(`Failed to send message to room ${roomId}: ${error.message}`));
    });
  }
}
