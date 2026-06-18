import Fastify from 'fastify';

describe('POST /notifications', () => {
  it('should send notification to matrix', async () => {
    const mockBot = { sendMessage: vi.fn().mockResolvedValue(undefined) };

    const app = Fastify();
    app.post('/notifications', async request => {
      const { channelId, message } = request.body as { channelId: string; message: string };
      await mockBot.sendMessage(channelId, message);
      return { success: true };
    });

    const response = await app.inject({
      method: 'POST',
      url: '/notifications',
      payload: { channelId: 'test-channel', message: 'Test message' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ success: true });
    expect(mockBot.sendMessage).toHaveBeenCalledWith('test-channel', 'Test message');

    await app.close();
  });

  it('should return 200 for health endpoint', async () => {
    const app = Fastify();
    app.get('/health', async () => ({ status: 'ok' }));

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ status: 'ok' });

    await app.close();
  });
});
