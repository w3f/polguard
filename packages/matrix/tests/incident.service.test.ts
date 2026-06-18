import { IncidentService } from '../src/service/incident.service';
import { MessengerType, HttpError } from '@w3f/polguard-common';

const mockLogger = {
  fatal: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
};

describe('IncidentService', () => {
  let service: IncidentService;
  const baseUrl = 'http://api:3000/incidents';

  beforeEach(() => {
    service = new IncidentService(baseUrl, mockLogger);
    vi.resetAllMocks();
  });

  describe('getNonResolved', () => {
    it('should return non-resolved incidents', async () => {
      const mockIncidents = [
        { id: 1, resolved: false },
        { id: 2, resolved: false },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockIncidents),
      });

      const result = await service.getNonResolved('test-room');

      expect(result).toEqual(mockIncidents);
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining(baseUrl));
      // Verify query params
      const calledUrl = (fetch as any).mock.calls[0][0] as string;
      const params = new URLSearchParams(calledUrl.split('?')[1]);
      expect(params.get('channelId')).toBe('test-room');
      expect(params.get('messengerType')).toBe(MessengerType.Matrix);
      expect(params.get('isResolved')).toBe('false');
    });

    it('should throw an error when the API call fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(service.getNonResolved('test-room')).rejects.toThrow('Network error');
    });
  });

  describe('getNonAcked', () => {
    it('should return non-acknowledged incidents', async () => {
      const mockIncidents = [
        { id: 1, ackRequired: true, acked: false },
        { id: 2, ackRequired: true, acked: false },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockIncidents),
      });

      const result = await service.getNonAcked('test-room');

      expect(result).toEqual(mockIncidents);
      const calledUrl = (fetch as any).mock.calls[0][0] as string;
      const params = new URLSearchParams(calledUrl.split('?')[1]);
      expect(params.get('channelId')).toBe('test-room');
      expect(params.get('messengerType')).toBe(MessengerType.Matrix);
      expect(params.get('needsAck')).toBe('true');
      expect(params.get('isAcked')).toBe('false');
    });
  });

  describe('getIncidentById', () => {
    it('should return an incident by ID', async () => {
      const mockIncident = { id: 'test-incident-1', message: 'Test incident' };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockIncident),
      });

      const result = await service.getIncidentById('test-incident-1');

      expect(result).toEqual(mockIncident);
      expect(fetch).toHaveBeenCalledWith(`${baseUrl}/test-incident-1`, undefined);
    });

    it('should throw HttpError on HTTP error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      try {
        await service.getIncidentById('nonexistent');
        fail('Expected an error');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).status).toBe(404);
      }
    });
  });

  describe('acknowledgeIncident', () => {
    it('should acknowledge an incident', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });

      await service.acknowledgeIncident('test-incident-1', 'test-user', 'test-room');

      expect(fetch).toHaveBeenCalledWith(`${baseUrl}/test-incident-1/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test-user', channelId: 'test-room' }),
      });
    });
  });
});
