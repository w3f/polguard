import { MatrixClient } from './matrix-client';
import { MatrixConfig, IncidentServiceInterface, QueryFilters } from './interfaces';
import { Logger, AppLogger, MessengerType, NotificationType, Chain } from '@w3f/polguard-common';
import { MatrixEvent } from 'matrix-js-sdk';
import { getGroupsForChannel } from '@w3f/polguard-config';

export class MatrixBot extends MatrixClient {
  // This property handles "Message too long (112988 bytes)"
  private static readonly MAX_INCIDENTS_PER_LIST = 50;
  private incidentService: IncidentServiceInterface;
  private readonly monitoringConfigsDir: string;

  constructor(
    config: MatrixConfig,
    logger: Logger,
    incidentService: IncidentServiceInterface,
    monitoringConfigsDir: string,
    dataPath?: string,
  ) {
    super(config, logger, dataPath);
    this.incidentService = incidentService;
    this.monitoringConfigsDir = monitoringConfigsDir;
  }

  async init() {
    await super.init();
    this.logger.log('MatrixBot initialized and listening for commands in rooms');
  }

  protected handleCommand(roomId: string, command: string, event: MatrixEvent) {
    const parts = command
      .slice(1)
      .split(' ')
      .filter(part => part.trim() !== '');
    const cmd = parts[0].toLowerCase();
    this.logger.debug(`Processing command: ${cmd} with parts: ${JSON.stringify(parts)}`);

    switch (cmd) {
      case 'help':
        this.handleHelpCommand(roomId);
        break;
      case 'unresolved':
        this.handleUnresolvedIncidentsCommand(roomId);
        break;
      case 'unacked':
        this.handleUnackedIncidentsCommand(roomId);
        break;
      case 'debug':
        if (parts.length < 2) {
          this.sendMessage(roomId, 'Usage: !debug &ltincident-id&gt');
        } else {
          const debugId = parts[1]?.trim();
          if (!debugId) {
            this.sendErrorMessage(roomId, 'Invalid incident ID');
          } else {
            this.handleDebugCommand(roomId, debugId);
          }
        }
        break;
      case 'show':
        if (parts.length < 2) {
          this.sendMessage(roomId, 'Usage: !show &ltincident-id&gt');
        } else {
          const showId = parts[1]?.trim();
          if (!showId) {
            this.sendErrorMessage(roomId, 'Invalid incident ID');
          } else {
            this.handleShowCommand(roomId, showId);
          }
        }
        break;
      case 'manual':
        this.handleManualCommand(roomId);
        break;
      case 'ack':
        if (parts.length < 2) {
          this.sendMessage(roomId, 'Usage: !ack &ltincident-id&gt');
        } else {
          const ackId = parts[1]?.trim();
          if (!ackId) {
            this.sendErrorMessage(roomId, 'Invalid incident ID');
          } else {
            this.handleAckCommand(roomId, ackId, event);
          }
        }
        break;
      case 'resolve':
        if (parts.length < 2) {
          this.sendMessage(roomId, 'Usage: !resolve &ltincident-id|ALL&gt');
        } else {
          const resolveId = parts[1]?.trim();
          if (!resolveId) {
            this.sendErrorMessage(roomId, 'Invalid incident ID');
          } else {
            this.handleResolveCommand(roomId, resolveId, event);
          }
        }
        break;
      case 'query':
        this.handleQueryCommand(roomId, parts.slice(1));
        break;
      case 'check':
        if (parts.length < 3) {
          this.sendMessage(roomId, 'Usage: !check &ltchain&gt &ltaccount&gt');
        } else {
          this.handleCheckCommand(roomId, parts[1], parts[2]);
        }
        break;
      case 'monitor':
        if (parts.length < 3) {
          this.sendMessage(roomId, 'Usage: !monitor &ltchain&gt &ltaccount&gt');
        } else {
          this.handleCheckCommand(roomId, parts[1], parts[2]);
        }
        break;
      default:
        this.sendErrorMessage(roomId, `Unknown command: ${cmd}`);
    }
  }

  private async handleHelpCommand(roomId: string) {
    const helpMessage = `<p><strong>Bot commands:</strong></p>
<ul>
  <li>
    <strong>!show &lt;id&gt;</strong><br/>
    <em>Show incident message</em>
  </li>
  <li>
    <strong>!ack &lt;id&gt;</strong><br/>
    <em>Acknowledge an incident by ID</em>
  </li>
  <li>
    <strong>!unacked</strong><br/>
    <em>List incidents requiring acknowledgment</em>
  </li>
  <li>
    <strong>!unresolved</strong><br/>
    <em>List unresolved incidents (ongoing onchain conditions)</em>
  </li>
  <li>
    <strong>!check &lt;chain&gt; &lt;account&gt;</strong><br/>
    <em>Check if an account is being monitored on a specific chain</em>
  </li>
  <li>
    <strong>!manual</strong><br/>
    <em>Show user manual</em>
  </li>
</ul>`;

    await this.sendMessage(roomId, helpMessage);
  }

  private async handleUnresolvedIncidentsCommand(roomId: string) {
    try {
      const incidents = await this.incidentService.getNonResolved(roomId);
      if (incidents.length === 0) {
        await this.sendMessage(roomId, '<p><strong>No unresolved incidents for this room</strong></p>');
      } else {
        const html = '<p><strong>Unresolved incidents:</strong></p>' + this.formatIncidentList(incidents);
        await this.sendMessage(roomId, html);
      }
    } catch (error) {
      this.logger.error(`Error unresolved active incidents: ${error.message}`);
      await this.sendErrorMessage(
        roomId,
        'An error occurred while fetching unresolved incidents. Please try again later',
      );
    }
  }

  private async handleUnackedIncidentsCommand(roomId: string) {
    try {
      const incidents = await this.incidentService.getNonAcked(roomId);
      if (incidents.length === 0) {
        await this.sendMessage(roomId, '<p>No incidents requiring acknowledgment for this room</p>');
      } else {
        const html = '<p><strong>Incidents requiring acknowledgment:</strong></p>' + this.formatIncidentList(incidents);
        await this.sendMessage(roomId, html);
      }
    } catch (error) {
      this.logger.error(`Error fetching unacknowledged incidents: ${error.message}`);
      await this.sendErrorMessage(
        roomId,
        'An error occurred while fetching unacknowledged incidents. Please try again later',
      );
    }
  }

  private async handleShowCommand(roomId: string, incidentId: string) {
    try {
      const incident = await this.incidentService.getIncidentById(incidentId);
      let message = `<p>${this.getDisplayMessage(incident, roomId, NotificationType.Alert)}</p>`;

      if (incident.isResolved && incident.resolutionMessage) {
        message += `<p>${this.getDisplayMessage(incident, roomId, NotificationType.Resolution)}</p>`;
      }

      await this.sendMessage(roomId, message);
    } catch (error) {
      this.logger.error(`Error fetching incident message: ${error.message}`);

      if (error.response?.status === 404) {
        await this.sendErrorMessage(roomId, `Incident with ID ${incidentId} not found`);
      } else {
        await this.sendErrorMessage(
          roomId,
          'An error occurred while fetching incident message. Please try again later',
        );
      }
    }
  }

  private async handleDebugCommand(roomId: string, incidentId: string) {
    try {
      const incident = await this.incidentService.getIncidentById(incidentId);

      // First show the message (same as show command)
      const displayMessage = this.getDisplayMessage(incident, roomId);
      await this.sendMessage(roomId, `<p>${displayMessage}</p>`);

      // Then show debug information
      const debugInfo = this.buildDebugInfo(incident);
      await this.sendMessage(roomId, debugInfo);
    } catch (error) {
      this.logger.error(`Error fetching incident details: ${error.message}`);

      if (error.response?.status === 404) {
        await this.sendErrorMessage(roomId, `Incident with ID ${incidentId} not found`);
      } else {
        await this.sendErrorMessage(
          roomId,
          'An error occurred while fetching incident details. Please try again later',
        );
      }
    }
  }

  private async handleManualCommand(roomId: string) {
    const manualMessage = `<p><strong>PolGuard User Manual</strong></p>

<p><strong>How It Works:</strong></p>
<p>Responsible teams configure the monitoring system by updating YAML files in Git repositories following the <a href="https://github.com/w3f/polguard/blob/master/packages/config/CONFIG_GUIDE.md">configuration guide</a>. The monitoring system periodically updates its active configuration from these repositories.</p>

<p>Every block, the system checks configured rules and generates incidents:</p>
<ul>
  <li><strong>ℹ️ One-time incidents:</strong> Generated from specific events or extrinsics that occurred onchain</li>
  <li><strong>🔥 Ongoing incidents:</strong> Generated when onchain conditions don't meet configured values (e.g., balance too low, reward destination is unexpected). These resolve automatically when conditions return to normal</li>
</ul>

<p><strong>Acknowledgment Process:</strong></p>
<p>1. Check incidents requiring acknowledgment: <code>!unacked</code><br/>
2. Acknowledge incident: <code>!ack &lt;incident-id&gt;</code><br/>
Incidents with exclamation points (❗) at the end require acknowledgment. Both one-time and ongoing incidents can require acknowledgment. Unacknowledged incidents escalate after a timeout, sending alerts to escalation channels.</p>

<p><strong>Ongoing Incident Process:</strong></p>
<p>1. Check ongoing unresolved incidents: <code>!unresolved</code><br/>
2. Take external action (e.g., send tokens to wallet for balance threshold, contact validator for reward destination change)<br/>
3. Wait for automatic resolution when conditions normalize, OR update configuration if current state is now correct</p>

<p>Use <code>!help</code> to see all available commands.</p>`;

    await this.sendMessage(roomId, manualMessage);
  }

  private async handleAckCommand(roomId: string, incidentId: string, event: MatrixEvent) {
    try {
      const userId = event.getSender();
      await this.incidentService.acknowledgeIncident(incidentId, userId, roomId);

      let message = `<p>Incident <strong>${incidentId}</strong> has been acknowledged</p>`;

      // Fetch remaining unacked incidents and show next 3
      try {
        const remainingIncidents = await this.incidentService.getNonAcked(roomId);
        if (remainingIncidents.length > 0) {
          const nextIncidents = remainingIncidents.slice(0, 3);
          message += `<p>Next incidents (${remainingIncidents.length} remaining):</p>`;
          message += this.formatIncidentList(nextIncidents);
        }
      } catch (error) {
        // Don't fail the ack if fetching next incidents fails, just log it
        this.logger.error(`Error fetching next incidents: ${error.message}`);
      }

      await this.sendMessage(roomId, message);
    } catch (error) {
      this.logger.error(`Error acknowledging incident: ${error.message}`);

      if (error.response?.status === 404) {
        await this.sendErrorMessage(roomId, `Incident with ID ${incidentId} not found`);
      } else if (error.response?.status === 403) {
        await this.sendErrorMessage(roomId, 'You do not have permission to acknowledge this incident');
      } else {
        await this.sendErrorMessage(roomId, 'An error occurred while acknowledging incident. Please try again later');
      }
    }
  }

  private async handleResolveCommand(roomId: string, incidentId: string, event: MatrixEvent) {
    try {
      const userId = event.getSender();

      if (incidentId.toUpperCase() === 'ALL') {
        const incidents = await this.incidentService.getNonResolved(roomId);

        if (incidents.length === 0) {
          await this.sendMessage(roomId, '<p>No unresolved incidents to resolve</p>');
          return;
        }

        let successCount = 0;
        let failCount = 0;

        for (const incident of incidents) {
          try {
            await this.incidentService.resolveIncident(incident.id, userId, roomId);
            successCount++;
          } catch (error) {
            this.logger.error(`Error resolving incident ${incident.id}: ${error.message}`);
            failCount++;
          }
        }

        await this.sendMessage(
          roomId,
          `<p>Resolved <strong>${successCount}</strong> incident(s)${failCount > 0 ? `, failed to resolve ${failCount}` : ''}</p>`,
        );
      } else {
        await this.incidentService.resolveIncident(incidentId, userId, roomId);
        await this.sendMessage(roomId, `<p>Incident <strong>${incidentId}</strong> has been resolved manually</p>`);
      }
    } catch (error) {
      this.logger.error(`Error resolving incident: ${error.message}`);

      if (error.response?.status === 404) {
        await this.sendErrorMessage(roomId, `Incident with ID ${incidentId} not found`);
      } else if (error.response?.status === 403) {
        await this.sendErrorMessage(roomId, 'You do not have permission to resolve this incident');
      } else {
        await this.sendErrorMessage(roomId, 'An error occurred while resolving incident. Please try again later');
      }
    }
  }

  private getDisplayMessage(incident: any, roomId: string, notificationType = NotificationType.Alert): string {
    const notification = incident.notifications?.find(
      notification =>
        notification.messengerType === MessengerType.Matrix &&
        notification.channelId === roomId &&
        notification.type === notificationType,
    );

    if (notification) {
      return notification.message;
    }

    // Fallback to raw incident data based on notification type
    return notificationType === NotificationType.Resolution ? incident.resolutionMessage : incident.message;
  }

  private buildDebugInfo(incident: any): string {
    let html = '<ul>';

    html += `<li><strong>Created:</strong> ${this.formatDate(incident.createdAt)}</li>`;
    html += `<li><strong>Resolved:</strong> ${incident.isResolved ? 'Yes' : 'No'}</li>`;

    if (incident.isResolved) {
      html += `<li><strong>Resolved at:</strong> ${this.formatDate(incident.resolvedAt)}</li>`;
    }

    html += `<li><strong>Acknowledgement required:</strong> ${incident.needsAck ? 'Yes' : 'No'}</li>`;

    if (incident.isAcked) {
      html += `<li><strong>Acknowledged by:</strong> ${incident.ackedBy}</li>`;
      html += `<li><strong>Acknowledged at:</strong> ${this.formatDate(incident.ackedAt)}</li>`;
    } else if (incident.needsAck) {
      html += `<li><strong>Acknowledged:</strong> No</li>`;
    }

    html += `<li><strong>Escalated:</strong> ${incident.isEscalated ? 'Yes' : 'No'}</li>`;

    if (incident.isEscalated && incident.escalatedAt) {
      html += `<li><strong>Escalated at:</strong> ${this.formatDate(incident.escalatedAt)}</li>`;
    }

    html += `<li><strong>Chain:</strong> ${incident.chain}</li>`;
    html += `<li><strong>Group:</strong> ${incident.groupId}</li>`;
    html += `<li><strong>Handler:</strong> ${incident.handlerType}</li>`;
    html += `<li><strong>Account:</strong> ${incident.account}</li>`;
    html += '</ul><br>';

    return html;
  }

  private async handleQueryCommand(roomId: string, args: string[]) {
    try {
      if (args.length === 0) {
        await this.sendMessage(
          roomId,
          'Usage: !query [filters...]\nExample: !query createdAfter=2025-01-01 createdBefore=2025-01-31 isResolved=false\nAvailable filters: account, groupId, handlerType, chain, createdAfter, createdBefore, isResolved, isAcked, needsAck',
        );
        return;
      }

      const validKeys = new Set([
        'account',
        'groupId',
        'handlerType',
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
          await this.sendErrorMessage(
            roomId,
            `Invalid filter: ${key}. Valid filters: ${Array.from(validKeys).join(', ')}`,
          );
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
        const html =
          `<p><strong>Query results (${incidents.length} incidents):</strong></p>` + this.formatIncidentList(incidents);
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

  private async handleCheckCommand(roomId: string, chainArg: string, account: string) {
    try {
      const validChains = Object.values(Chain);
      const chain = validChains.find(c => c.toLowerCase() === chainArg.toLowerCase());

      if (!chain) {
        await this.sendErrorMessage(roomId, `Invalid chain: ${chainArg}. Valid chains: ${validChains.join(', ')}`);
        return;
      }

      const configLogger: AppLogger = {
        ...this.logger,
        info: this.logger.log.bind(this.logger),
        trace: this.logger.verbose.bind(this.logger),
      };
      // TODO: Ideally matrix should not have access to the monitoring configs. This command may be removed soon.
      const groups = await getGroupsForChannel(
        chain,
        MessengerType.Matrix,
        roomId,
        this.monitoringConfigsDir,
        configLogger,
      );

      const matchingGroups: string[] = [];
      for (const group of groups) {
        const hasAccount = group.accounts.some(acc => acc.ss58 === account);
        if (hasAccount) {
          matchingGroups.push(group.id);
        }
      }

      if (matchingGroups.length === 0) {
        await this.sendMessage(
          roomId,
          `<p>Account <strong>${account}</strong> is not being monitored on chain ${chain} for this channel</p>`,
        );
      } else {
        const groupsList = matchingGroups.join(', ');
        await this.sendMessage(
          roomId,
          `<p>Account <strong>${account}</strong> is being monitored on chain ${chain}, as a member of the following monitoring groups: ${groupsList}</p>`,
        );
      }
    } catch (error) {
      this.logger.error(`Error checking account monitoring status: ${error.message}`);
      await this.sendErrorMessage(
        roomId,
        'An error occurred while checking account monitoring status. Please try again later',
      );
    }
  }

  private formatIncidentList(incidents: any[]): string {
    const limitedIncidents = incidents.slice(0, MatrixBot.MAX_INCIDENTS_PER_LIST);
    const items = limitedIncidents
      .map(inc => {
        const subscanLink = this.generateSubscanLink(inc);
        return `<li><strong>${inc.id}</strong> &ndash; <i>${this.formatDate(inc.createdAt)}</i> &ndash; ${inc.handlerType} &ndash; ${subscanLink}</li>`;
      })
      .join('');

    let html = `<ul>${items}</ul>`;
    if (incidents.length > MatrixBot.MAX_INCIDENTS_PER_LIST) {
      html += `<p><em>List limited to first ${MatrixBot.MAX_INCIDENTS_PER_LIST} incidents (total: ${incidents.length})</em></p>`;
    }
    return html + '<br>';
  }

  private generateSubscanLink(incident: any): string {
    const chain = incident.chain.toLowerCase();
    const block = incident.blockNumber;

    if (incident.eventIdx) {
      const url = `https://${chain}.subscan.io/event/${block}-${incident.eventIdx}`;
      return `<a href="${url}">Subscan (event)</a>`;
    } else if (incident.extrinsicIdx) {
      const url = `https://${chain}.subscan.io/extrinsic/${block}-${incident.extrinsicIdx}`;
      return `<a href="${url}">Subscan (extrinsic)</a>`;
    } else {
      const url = `https://${chain}.subscan.io/block/${block}`;
      return `<a href="${url}">Subscan (block)</a>`;
    }
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
