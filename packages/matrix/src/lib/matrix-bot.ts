import { MatrixClient } from './matrix-client';
import { MatrixConfig, IncidentServiceInterface } from './interfaces';
import { Logger } from '@w3f/monitoring-types';
import { MatrixEvent } from 'matrix-js-sdk';

export class MatrixBot extends MatrixClient {
  private incidentService: IncidentServiceInterface;

  constructor(config: MatrixConfig, logger: Logger, incidentService: IncidentServiceInterface, dataPath?: string) {
    super(config, logger, dataPath);
    this.incidentService = incidentService;
  }

  protected handleCommand(roomId: string, command: string, event: MatrixEvent) {
    const parts = command.slice(1).split(' ');
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
      case 'help':
        this.handleHelpCommand(roomId);
        break;
      case 'open':
        this.handleOpenIncidentsCommand(roomId);
        break;
      case 'unacked':
        this.handleUnackedIncidentsCommand(roomId);
        break;
      case 'incident':
        if (parts.length < 2) {
          this.sendMessage(roomId, 'Usage: !incident <id>');
        } else {
          this.handleIncidentDetailsCommand(roomId, parts[1]);
        }
        break;
      case 'ack':
        if (parts.length < 2) {
          this.sendMessage(roomId, 'Usage: !ack <incident-id>');
        } else {
          this.handleAckCommand(roomId, parts[1], event);
        }
        break;
      default:
        this.sendMessage(roomId, `Unknown command: ${cmd}`);
    }
  }

  private async handleHelpCommand(roomId: string) {
    await this.sendMessage(
      roomId,
      'Available commands:\n' +
        '!help - Show this help message\n' +
        '!open - List all open (non-resolved) incidents\n' +
        '!unacked - List all incidents requiring acknowledgment\n' +
        '!incident <id> - Show detailed information about a specific incident\n' +
        '!ack <id> - Acknowledge an incident by ID',
    );
  }

  private async handleOpenIncidentsCommand(roomId: string) {
    try {
      const incidents = await this.incidentService.getNonResolved(roomId);
      if (incidents.length === 0) {
        await this.sendMessage(roomId, 'No open incidents for this room.');
      } else {
        // Group incidents by acknowledgment status and requirement
        const requireAckNotAcked = incidents.filter(inc => inc.ackRequired && !inc.acked);
        const requireAckAndAcked = incidents.filter(inc => inc.ackRequired && inc.acked);
        const noAckRequired = incidents.filter(inc => !inc.ackRequired);

        let message = '';

        if (requireAckNotAcked.length > 0) {
          const requireAckList = requireAckNotAcked
            .map(inc => `- ID: ${inc.id}, Created: ${this.formatDate(inc.createdAt)}`)
            .join('\n');
          message += `Incidents requiring acknowledgment:\n${requireAckList}\n\n`;
        }

        if (requireAckAndAcked.length > 0) {
          const ackedList = requireAckAndAcked
            .map(
              inc =>
                `- ID: ${inc.id}, Acked by: ${inc.ackedByUser}, Acked at: ${this.formatDate(inc.ackedAt)}, Created: ${this.formatDate(inc.createdAt)}`,
            )
            .join('\n');
          message += `Acknowledged incidents:\n${ackedList}\n\n`;
        }

        if (noAckRequired.length > 0) {
          const noAckList = noAckRequired
            .map(inc => `- ID: ${inc.id}, Created: ${this.formatDate(inc.createdAt)}`)
            .join('\n');
          message += `Incidents (no acknowledgment required):\n${noAckList}`;
        }

        await this.sendMessage(roomId, message.trim());
      }
    } catch (error) {
      this.logger.error(`Error fetching open incidents: ${error.message}`);
      await this.sendMessage(roomId, 'An error occurred while fetching open incidents. Please try again later.');
    }
  }

  private async handleUnackedIncidentsCommand(roomId: string) {
    try {
      const incidents = await this.incidentService.getNonAcked(roomId);
      if (incidents.length === 0) {
        await this.sendMessage(roomId, 'No incidents requiring acknowledgment for this room.');
      } else {
        const incidentList = incidents
          .map(
            inc =>
              `- ID: ${inc.id}, Created: ${this.formatDate(inc.createdAt)}, Resolved: ${inc.resolved ? 'Yes' : 'No'}`,
          )
          .join('\n');
        await this.sendMessage(roomId, `Incidents requiring acknowledgment:\n${incidentList}`);
      }
    } catch (error) {
      this.logger.error(`Error fetching unacknowledged incidents: ${error.message}`);
      await this.sendMessage(
        roomId,
        'An error occurred while fetching unacknowledged incidents. Please try again later.',
      );
    }
  }

  private async handleIncidentDetailsCommand(roomId: string, incidentIdStr: string) {
    try {
      const incidentId = parseInt(incidentIdStr, 10);
      if (isNaN(incidentId)) {
        await this.sendMessage(roomId, 'Invalid incident ID. Please provide a valid number.');
        return;
      }

      const incident = await this.incidentService.getIncidentById(incidentId);

      let details = `Incident #${incident.id}\n`;
      details += `Message: ${incident.message}\n`;
      details += `Created: ${this.formatDate(incident.createdAt)}\n`;
      details += `Chain: ${incident.chain}\n`;
      details += `Group: ${incident.groupId}\n`;
      details += `Handler: ${incident.handlerName}\n`;
      details += `Wallet: ${incident.wallet}\n`;
      details += `Acknowledgment Required: ${incident.ackRequired ? 'Yes' : 'No'}\n`;

      if (incident.acked) {
        details += `Acknowledged: Yes\n`;
        details += `Acknowledged By: ${incident.ackedByUser}\n`;
        details += `Acknowledged At: ${this.formatDate(incident.ackedAt)}\n`;
      } else {
        details += `Acknowledged: No\n`;
      }

      if (incident.resolved) {
        details += `Resolved: Yes\n`;
        details += `Resolved At: ${this.formatDate(incident.resolvedAt)}\n`;
      } else {
        details += `Resolved: No\n`;
      }

      await this.sendMessage(roomId, details);
    } catch (error) {
      this.logger.error(`Error fetching incident details: ${error.message}`);
      await this.sendMessage(roomId, `Failed to fetch incident details: ${error.message}`);
    }
  }

  private async handleAckCommand(roomId: string, incidentIdStr: string, event: MatrixEvent) {
    try {
      const incidentId = parseInt(incidentIdStr, 10);
      if (isNaN(incidentId)) {
        await this.sendMessage(roomId, 'Invalid incident ID. Please provide a valid number.');
        return;
      }

      const userId = event.getSender();

      await this.incidentService.acknowledgeIncident(incidentId, userId, roomId);
      await this.sendMessage(roomId, `Incident ${incidentId} has been acknowledged by ${userId}.`);
    } catch (error) {
      this.logger.error(`Error acknowledging incident: ${error.message}`);
      await this.sendMessage(roomId, `Failed to acknowledge incident: ${error.message}`);
    }
  }

  private formatDate(date: Date): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  }
}
