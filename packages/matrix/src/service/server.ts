import Fastify from 'fastify';
import { AppLogger, Style } from '@w3f/polguard-common';
import { alertmanagerSchema, AlertmanagerPayload, renderAlerts } from '../lib/alertmanager';

export interface Sender {
  sendMessage(roomId: string, formatted: string, plain?: string): Promise<void>;
}

type Room = { roomId: string };

const roomParams = {
  type: 'object',
  properties: { roomId: { type: 'string', pattern: '^![^:\\s]+:\\S+$' } },
};

const messageBody = {
  type: 'object',
  required: ['message'],
  properties: { message: { type: 'string' } },
};

export function buildServer(sender: Sender, logger: AppLogger) {
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({ status: 'ok' }));

  app.post<{ Params: Room; Body: { message: string } }>(
    '/notifications/:roomId',
    { schema: { params: roomParams, body: messageBody } },
    async ({ params, body }) => {
      await sender.sendMessage(params.roomId, body.message);
      return { success: true };
    },
  );

  app.post<{ Params: Room; Body: AlertmanagerPayload }>(
    '/notifications/:roomId/alertmanager',
    { schema: { params: roomParams, body: alertmanagerSchema } },
    async ({ params, body }) => {
      await sender.sendMessage(params.roomId, renderAlerts(Style.Html, body), renderAlerts(Style.Plain, body));
      return { success: true };
    },
  );

  app.setErrorHandler((error, request, reply) => {
    const clientError = error.statusCode !== undefined && error.statusCode < 500;
    if (!clientError) {
      logger.error(`Delivery to ${(request.params as Room).roomId} failed: ${error.message}`);
    }
    reply.status(clientError ? error.statusCode : 502).send({ error: error.message });
  });

  return app;
}
