import { MatrixClient } from './matrix-client';
import { MatrixConfig, IncidentServiceInterface, QueryFilters } from './interfaces';
import { Logger } from '@w3f/monitoring-types';
import { MatrixEvent } from 'matrix-js-sdk';

export class MatrixBot extends MatrixClient {
  private incidentService: IncidentServiceInterface;

  constructor(config: MatrixConfig, logger: Logger, incidentService: IncidentServiceInterface, dataPath?: string) {
    super(config, logger, dataPath);
    this.incidentService = incidentService;
  }

  async init() {
    await super.init();
    this.logger.log('MatrixBot initialized and listening for commands in rooms');
  }

  protected handleCommand(roomId: string, command: string, event: MatrixEvent) {
    const parts = command.slice(1).split(' ');
    const cmd = parts[0].toLowerCase();
    this.logger.debug(`Processing command: ${cmd} with parts: ${JSON.stringify(parts)}`);

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
      case 'query':
        this.handleQueryCommand(roomId, parts.slice(1));
        break;
      default:
        this.sendErrorMessage(roomId, `Unknown command: ${cmd}`);
    }
  }

  private async handleHelpCommand(roomId: string) {
    const helpMessage = `<p><strong>Bot commands:</strong></p>
<ul>
  <li>
    <strong>!help</strong><br/>
    <em>Show this help message</em>
  </li>
  <li>
    <strong>!open</strong><br/>
    <em>List all open (non-resolved) incidents</em>
  </li>
  <li>
    <strong>!unacked</strong><br/>
    <em>List incidents requiring acknowledgment</em>
  </li>
  <li>
    <strong>!incident &lt;id&gt;</strong><br/>
    <em>Show detailed information about a specific incident</em>
  </li>
  <li>
    <strong>!ack &lt;id&gt;</strong><br/>
    <em>Acknowledge an incident by ID</em>
  </li>
  <li>
    <strong>!query [filters...]</strong><br/>
    <em>Query incidents with custom filters<br/>
    Ex.: !query createdAfter=2025-01-01 createdBefore=2025-01-31 isResolved=false</em>
  </li>
</ul>`;

    await this.sendMessage(roomId, helpMessage);
  }

  private async handleOpenIncidentsCommand(roomId: string) {
    try {
      const incidents = await this.incidentService.getNonResolved(roomId);
      if (incidents.length === 0) {
        await this.sendMessage(roomId, '<p><strong>No open incidents for this room.</strong></p>');
      } else {
        let html = '<p><strong>Open incidents:</strong></p><ul>';
        const items = incidents
          .map(inc => `<li><strong>#${inc.id}</strong> - ${this.formatDate(inc.createdAt)} - ${inc.handlerType}</li>`)
          .join('');
        html += items + '</ul><br>';
        await this.sendMessage(roomId, html);
      }
    } catch (error) {
      this.logger.error(`Error fetching open incidents: ${error.message}`);
      await this.sendErrorMessage(roomId, 'An error occurred while fetching open incidents. Please try again later');
    }
  }

  private async handleUnackedIncidentsCommand(roomId: string) {
    try {
      const incidents = await this.incidentService.getNonAcked(roomId);
      if (incidents.length === 0) {
        await this.sendMessage(roomId, '<p><strong>No incidents requiring acknowledgment for this room.</strong></p>');
      } else {
        let html = '<strong>Incidents requiring acknowledgment:</strong><ul>';
        const items = incidents
          .map(inc => `<li><strong>#${inc.id}</strong> - ${this.formatDate(inc.createdAt)} - ${inc.handlerType}</li>`)
          .join('');
        html += items + '</ul><br>';
        await this.sendMessage(roomId, html);
      }
    } catch (error) {
      this.logger.error(`Error fetching unacknowledged incidents: ${error.message}`);
      await this.sendErrorMessage(roomId, 'An error occurred while fetching unacknowledged incidents. Please try again later');
    }
  }

  private async handleIncidentDetailsCommand(roomId: string, incidentIdStr: string) {
    try {
      const incidentId = parseInt(incidentIdStr, 10);
      if (isNaN(incidentId)) {
        await this.sendErrorMessage(roomId, 'Invalid incident ID. Please provide a valid number.');
        return;
      }

      const incident = await this.incidentService.getIncidentById(incidentId);
      let html = `<blockquote>${incident.message}</blockquote>`;
      html += '<ul>';

      html += `<li><strong>Created:</strong> ${this.formatDate(incident.createdAt)}</li>`;
      html += `<li><strong>Resolved:</strong> ${incident.isResolved ? 'Yes' : 'No'}</li>`;
      html += `<li><strong>Acknowledgement required:</strong> ${incident.needsAck ? 'Yes' : 'No'}</li>`;

      if (incident.isAcked) {
        html += `<li><strong>Acknowledged by:</strong> ${incident.ackedBy}</li>`;
        html += `<li><strong>Acknowledged at:</strong> ${this.formatDate(incident.ackedAt)}</li>`;
      } else if (incident.needsAck) {
        html += `<li><strong>Acknowledged:</strong> No</li>`;
      }

      if (incident.isResolved) {
        html += `<li><strong>Resolved at:</strong> ${this.formatDate(incident.resolvedAt)}</li>`;
      }

      html += `<li><strong>Group:</strong> ${incident.groupId}</li>`;
      html += `<li><strong>Handler:</strong> ${incident.handlerType}</li>`;

      html += '</ul><br>';

      await this.sendMessage(roomId, html);
    } catch (error) {
      this.logger.error(`Error fetching incident details: ${error.message}`);
      await this.sendErrorMessage(roomId, 'An error occurred while fetching incident details. Please try again later');
    }
  }

  private async handleAckCommand(roomId: string, incidentIdStr: string, event: MatrixEvent) {
    try {
      const incidentId = parseInt(incidentIdStr, 10);
      if (isNaN(incidentId)) {
        await this.sendErrorMessage(roomId, 'Invalid incident ID. Please provide a valid number');
        return;
      }

      const userId = event.getSender();

      await this.incidentService.acknowledgeIncident(incidentId, userId, roomId);
      await this.sendMessage(
        roomId,
        `<p><strong>Success:</strong> Incident <strong>#${incidentId}</strong> has been acknowledged</p>`,
      );
    } catch (error) {
      this.logger.error(`Error acknowledging incident: ${error.message}`);
      await this.sendErrorMessage(roomId, 'An error occurred while acknowledging incident. Please try again later');
    }
  }

  private async handleQueryCommand(roomId: string, args: string[]) {
    try {
      if (args.length === 0) {
        await this.sendMessage(
          roomId,
          'Usage: !query [filters...]\nExample: !query createdAfter=2025-01-01 createdBefore=2025-01-31 isResolved=false\nAvailable filters: account, groupId, handlerType, status, chain, createdAfter, createdBefore, isResolved, isAcked, needsAck',
        );
        return;
      }

      const validKeys = new Set([
        'account',
        'groupId',
        'handlerType',
        'status',
        'chain',
        'createdAfter',
        'createdBefore',
        'isResolved',
        'isAcked',
        'needsAck',
      ]);
      const booleanFields = new Set(['isResolved', 'isAcked', 'needsAck']);
      const filters: QueryFilters = {};

      for (const arg of args) {
        const [key, value] = arg.split('=');
        if (!key || !value) {
          await this.sendErrorMessage(roomId, `Invalid filter format: ${arg}. Use key=value format`);
          return;
        }

        if (!validKeys.has(key)) {
          await this.sendErrorMessage(roomId, `Invalid filter: ${key}. Valid filters: ${Array.from(validKeys).join(', ')}`);
          return;
        }

        if (booleanFields.has(key)) {
          filters[key] = value.toLowerCase() === 'true';
        } else {
          filters[key] = value;
        }
      }

      const incidents = await this.incidentService.queryIncidents(roomId, filters);

      if (incidents.length === 0) {
        await this.sendMessage(roomId, '<p><strong>No incidents found matching the specified filters</strong></p>');
      } else {
        let html = `<p><strong>Query results (${incidents.length} incidents):</strong></p><ul>`;
        const items = incidents
          .map(
            inc =>
              `<li><strong>#${inc.id}</strong> - ${this.formatDate(inc.createdAt)} - ${inc.handlerType} - ${inc.groupId}</li>`,
          )
          .join('');
        html += items + '</ul><br>';
        await this.sendMessage(roomId, html);
      }
    } catch (error) {
      this.logger.error(`Error querying incidents: ${error.message}`);
      await this.sendErrorMessage(roomId, 'An error occurred while querying incidents. Please try again later');
    }
  }

  private async sendErrorMessage(roomId: string, message: string): Promise<void> {
    await this.sendMessage(roomId, `<p><strong>Error:</strong> ${message}</p>`);
  }

  private formatDate(date: Date): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}
