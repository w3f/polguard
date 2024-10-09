import { MatrixEvent, Room } from 'matrix-js-sdk';
import { MatrixClient } from './matrix-client';
import { MatrixConfig, Logger, IncidentServiceInterface } from './interfaces';

export class MatrixBot extends MatrixClient {
  private incidentService: IncidentServiceInterface;

  constructor(config: MatrixConfig, logger: Logger, incidentService: IncidentServiceInterface) {
    super(config, logger);
    this.incidentService = incidentService;
  }

  protected handleCommand(roomId: string, command: string) {
    const [cmd, ...args] = command.slice(1).split(' ');

    switch (cmd.toLowerCase()) {
      case 'help':
        this.handleHelpCommand(roomId);
        break;
      case 'pending':
        this.handlePendingCommand(roomId);
        break;
      default:
        this.sendMessage(roomId, `Unknown command: ${cmd}`);
    }
  }

  private async handleHelpCommand(roomId: string) {
    await this.sendMessage(roomId, 'Available commands: !help, !pending');
  }

  private async handlePendingCommand(roomId: string) {
    try {
      const incidents = await this.incidentService.getNonAckedIncidentsForRoom(roomId);
      if (incidents.length === 0) {
        await this.sendMessage(roomId, 'No pending incidents for this room.');
      } else {
        const incidentList = incidents
          .map((inc) => `- ID: ${inc.id}, Description: ...`)
          .join('\n');
        await this.sendMessage(roomId, `Pending incidents:\n${incidentList}`);
      }
    } catch (error) {
      this.logger.error(`Error fetching pending incidents: ${error.message}`);
      await this.sendMessage(
        roomId,
        'An error occurred while fetching pending incidents. Please try again later.'
      );
    }
  }
}
