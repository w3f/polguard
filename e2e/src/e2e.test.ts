import axios from 'axios';
import { setTimeout as sleep } from 'node:timers/promises';
import { ConfigService } from './config.js';

const config = new ConfigService().getConfig();
console.log(`Configuration: ${JSON.stringify({
  ...config, matrix: { ...config.matrix, tokenAuth: { ...config.matrix.tokenAuth, accessToken: '***' } }
}, null, 2)}`);

const timeoutMs = (config.timeoutSeconds || 180) * 1000;
global.setTimeout(() => {
  console.error(`❌ E2E test timed out after ${timeoutMs}ms`);
  process.exit(1);
}, timeoutMs);

async function runE2ETest() {
  try {
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
    await waitForMatrixNotification(config.matrix.roomId, config.matrix.messagePattern);
    console.log('✅ Matrix notification found\n✅ All E2E tests passed successfully');

    // Wait for Matrix escalation notification
    console.log(`Checking Matrix escalation notifications for message pattern "${config.matrix.escalationMessagePattern}"...`);
    await waitForMatrixNotification(config.matrix.escalationRoomId, config.matrix.escalationMessagePattern);
    console.log('✅ Matrix escalation notification found');

    console.log('✅ All E2E tests passed successfully');
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
      console.log('Getting metrics...');
      const response = await axios.get(`${config.chain.metricsUrl}/metrics`);
      console.log('Got metrics response.');
      console.log(`Response is ${response.data.length} bytes long.`);

      const blockMatch = response.data.match(/^monitoring_chain_latest_block_on_chain\s\d+$/gm);
      console.log(`blockMatch is: ${blockMatch}`);

      if (blockMatch) {
        const [_metricName, currentBlockStr] = blockMatch[0].split(' ');
        const currentBlock = parseInt(currentBlockStr, 10);
        console.log(`Current block: ${currentBlock}, Target block: ${targetBlock}`);
        if (currentBlock >= targetBlock) return;
      } else {
        console.log('No block metric found in metrics response');
      }
    } catch (error) {
      console.warn('WARN: Error checking chain metrics:', String(error));
      console.log('Will retry to get metrics.');
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

interface MatrixMessage {
  event_id: string;
  sender: string;
  content: {
    body: string;
    msgtype: string;
  };
  type: string;
  origin_server_ts: number;
}

async function waitForMatrixNotification(
  roomId: string,
  messagePattern: string,
): Promise<void> {
  const re = new RegExp(messagePattern);
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  while (true) {
    try {
      const response = await axios.get(
        `${config.matrix.homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages`,
        {
          params: {
            limit: 20,
            dir: 'b', // backwards from the most recent event
            from: '', // empty string to start from the most recent event
          },
          headers: {
            Authorization: `Bearer ${config.matrix.tokenAuth.accessToken}`,
          },
        }
      );
      const messages: MatrixMessage[] = response.data.chunk || [];

      // Filter for recent messages (last 5 minutes)
      const recentMessages = messages.filter(msg =>
        msg.origin_server_ts > fiveMinutesAgo &&
        msg.type === 'm.room.message' &&
        msg.content.msgtype === 'm.text'
      );

      // Check if any message matches the pattern
      for (const msg of recentMessages) {
        if (re.test(msg.content.body)) {
          console.log(`Found matching message: ${msg.content.body}`);
          return;
        }
      }

      console.log('Waiting for Matrix notification…');
    } catch (error) {
      console.warn('Error checking Matrix messages:', String(error));
    }

    await sleep(5_000);
  }
}
