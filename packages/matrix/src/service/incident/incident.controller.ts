import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { IncidentEvent, MessengerType } from '@w3f/monitoring-types';
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
    try {
      if (!event.alerts.messengerType) {
        throw new Error('Missing messenger type in alerts configuration');
      }

      if (event.alerts.messengerType !== MessengerType.Matrix) {
        this.logger.debug('Skipping Matrix notification for non-Matrix messenger type');
        return;
      }

      if (!Array.isArray(event.alerts.targets)) {
        throw new Error('Invalid or missing targets array in alerts configuration');
      }

      const sendPromises = event.alerts.targets.map(roomId =>
        this.matrixClient.sendMessage(roomId, event.message).catch(error => {
          this.logger.error(`Failed to send message to room ${roomId}: ${error.message}`);
          throw error;
        }),
      );

      await Promise.all(sendPromises);
    } catch (error) {
      this.logger.error('Matrix notification failed:', error.message);
      this.logger.error('Failed notification event:', JSON.stringify(event, null, 2));
      throw error;
    }
  }
}
