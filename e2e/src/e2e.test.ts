import axios from 'axios';
import { setTimeout as sleep } from 'timers/promises';
import { ConfigService } from './config.js';
import { createClient, RoomEvent, MatrixEvent, IContent, EventType, MatrixEventEvent, MatrixClient, Direction } from 'matrix-js-sdk';
import { webcrypto } from 'node:crypto';

(globalThis as any).crypto ??= webcrypto as unknown as Crypto;

const config = new ConfigService().getConfig();
console.log(`Configuration: ${JSON.stringify({
  ...config, matrix: { ...config.matrix, password: config.matrix.password ? '***' : undefined }
}, null, 2)}`);

const timeoutMs = (config.timeoutSeconds || 180) * 1000;
global.setTimeout(() => {
  console.error(`❌ E2E test timed out after ${timeoutMs}ms`);
  process.exit(1);
}, timeoutMs);

async function runE2ETest() {
  try {
    const matrixClient = await createMatrixClient({
      homeserver: config.matrix.homeserver,
      userId: config.matrix.userId,
      password: config.matrix.password || '',
      roomId: config.matrix.roomId
    });
    
    // Wait for chain block
    console.log(`Waiting for chain to process block ${config.chain.targetBlock}...`);
    await waitForChainBlock(config.chain.targetBlock);
    console.log('✅ Chain has processed the target block');

    // Wait for incident
    console.log(`Waiting for incidents with handler type "${config.api.incident.handlerType}"...`);
    await waitForIncident(config.api.incident.handlerType);
    console.log(`✅ Found incidents with handler type "${config.api.incident.handlerType}"`);

    // Wait for Matrix notification
    console.log(`Checking Matrix notifications for message pattern "${config.matrix.messagePattern}"...`);
    
    await waitForMatrixNotification(matrixClient, config.matrix.roomId, config.matrix.messagePattern);
    
    matrixClient.stopClient();
    console.log('✅ Matrix notification found\n✅ All E2E tests passed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ E2E test failed with error:', error);
    process.exit(1);
  }
}

runE2ETest();

async function waitForChainBlock(targetBlock: number): Promise<void> {
  while (true) {
    try {
      const response = await axios.get(`${config.chain.url}/metrics`);
      const blockMatch = response.data.match(/mp_chain_watcher_block_height{[^}]*} (\d+)/);
      
      if (blockMatch) {
        const currentBlock = parseInt(blockMatch[1], 10);
        console.log(`Current block: ${currentBlock}, Target block: ${targetBlock}`);
        if (currentBlock >= targetBlock) return;
      } else {
        console.log('No block metric found in metrics response');
      }
    } catch (error) {
      console.warn('Error checking chain metrics:', String(error));
    }
    await sleep(5_000);
  }
}

async function waitForIncident(handlerType: string): Promise<void> {
  while (true) {
    try {
      const incidents: any[] = (await axios.get(`${config.api.url}/incidents`)).data;
      if (incidents.some(incident => incident.handlerType === handlerType)) return;
      console.log(`Waiting for incidents with handler type "${handlerType}"...`);
    } catch (error) {
      console.warn('Error checking incidents:', String(error));
    }
    await sleep(5_000);
  }
}

async function waitForMatrixNotification(
  client: MatrixClient,
  roomId: string,
  messagePattern: string,
  historyDepth = 10,
): Promise<void> {
  const re = new RegExp(messagePattern);
  while (true) {
    const room = client.getRoom(roomId);
    if (room) {
      const recent: MatrixEvent[] =
        room.getLiveTimeline().getEvents().slice(-historyDepth);
      for (const ev of recent) {
        if (ev.getRoomId() !== roomId || ev.getType() !== EventType.RoomMessage)
          continue;

        if (ev.isEncrypted()) {
          await client.decryptEventIfNeeded(ev);
        }
        const body = ev.getContent<{ body?: string }>().body ?? "";
        if (re.test(body)) return;
      }
    }
    console.log('Waiting for Matrix notification…');
    await sleep(5_000);
  }
}




async function createMatrixClient(config: { homeserver: string; userId: string; password: string; roomId: string }): Promise<MatrixClient> {
  const authClient = createClient({ baseUrl: config.homeserver });
  const { access_token, user_id, device_id } = await authClient.loginRequest({
    type: 'm.login.password',
    identifier: { type: 'm.id.user', user: config.userId },
    password: config.password,
  });

  const client = createClient({
    baseUrl: config.homeserver,
    accessToken: access_token,
    userId: user_id,
    deviceId: device_id,
  });

  await client.initRustCrypto({ useIndexedDB: false });
  await client.joinRoom(config.roomId).catch(() => {});
  await client.startClient();
  
  return client;
}
