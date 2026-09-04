import { buildServer } from '../src/service/server';

const room = '!abc:example.org';
const alert = { status: 'firing', labels: { alertname: 'KubePodCrashLooping', namespace: 'monitoring' } };

describe('notification routes', () => {
  const sender = { sendMessage: vi.fn() };
  const post = (url: string, payload: unknown) =>
    buildServer(sender, { error: vi.fn() } as any).inject({ method: 'POST', url, payload });

  beforeEach(() => {
    sender.sendMessage.mockReset();
  });

  it('delivers a plain message to the room in the path', async () => {
    const response = await post(`/notifications/${encodeURIComponent(room)}`, { message: 'hello' });
    expect(response.statusCode).toBe(200);
    expect(sender.sendMessage).toHaveBeenCalledWith(room, 'hello');
  });

  it('renders an Alertmanager payload in both styles', async () => {
    const response = await post(`/notifications/${room}/alertmanager`, { status: 'firing', alerts: [alert] });
    expect(response.statusCode).toBe(200);
    const [roomId, html, plain] = sender.sendMessage.mock.calls[0];
    expect(roomId).toBe(room);
    expect(html).toContain('<strong>KubePodCrashLooping</strong>');
    expect(plain).toContain('🔥 KubePodCrashLooping');
  });

  it.each([
    ['/notifications/not-a-room', { message: 'hello' }],
    [`/notifications/${room}`, {}],
    [`/notifications/${room}/alertmanager`, { status: 'firing', alerts: [] }],
    [`/notifications/${room}/alertmanager`, { status: 'firing', alerts: [{ status: 'firing' }] }],
  ])('rejects %s with %j', async (url, payload) => {
    const response = await post(url, payload);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty('error');
    expect(sender.sendMessage).not.toHaveBeenCalled();
  });

  it('answers 502 when delivery fails', async () => {
    sender.sendMessage.mockRejectedValue(new Error('homeserver down'));
    const response = await post(`/notifications/${room}`, { message: 'hello' });
    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ error: 'homeserver down' });
  });
});
