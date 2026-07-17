import { Incident, IncidentServiceInterface } from '../lib/interfaces';
import { AppLogger, MessengerType, GetIncidentsQuery, fetchOrThrow } from '@w3f/polguard-common';

export class IncidentService implements IncidentServiceInterface {
  constructor(
    private readonly baseUrl: string,
    private readonly logger: AppLogger,
  ) {}

  async getNonResolved(roomId: string): Promise<Incident[]> {
    const params = new URLSearchParams({
      channelId: roomId,
      messengerType: MessengerType.Matrix,
      isResolved: 'false',
    });
    const response = await fetch(`${this.baseUrl}?${params}`);
    return response.json();
  }

  async getNonAcked(roomId: string): Promise<Incident[]> {
    const params = new URLSearchParams({
      channelId: roomId,
      messengerType: MessengerType.Matrix,
      needsAck: 'true',
      isAcked: 'false',
    });
    const response = await fetch(`${this.baseUrl}?${params}`);
    return response.json();
  }

  async getIncidentById(incidentId: string): Promise<Incident> {
    const response = await fetchOrThrow(`${this.baseUrl}/${incidentId}`);
    return response.json();
  }

  async acknowledgeIncident(incidentId: string, username: string, channelId: string): Promise<void> {
    await fetchOrThrow(`${this.baseUrl}/${incidentId}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, channelId }),
    });
  }

  async resolveIncident(incidentId: string, username: string, channelId: string): Promise<void> {
    await fetchOrThrow(`${this.baseUrl}/${incidentId}/resolve-manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, channelId }),
    });
  }

  async queryIncidents(roomId: string, filters: Partial<GetIncidentsQuery>): Promise<Incident[]> {
    const params = new URLSearchParams({
      channelId: roomId,
      messengerType: MessengerType.Matrix,
    });

    // Add optional filters
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    }

    const response = await fetch(`${this.baseUrl}?${params}`);
    return response.json();
  }
}
