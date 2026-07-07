import {
  MatrixClient as SDKMatrixClient,
  createClient,
  ClientEvent,
  MatrixEvent,
  Room,
  RoomEvent,
  MsgType,
  ICreateClientOpts,
  MatrixError,
  AuthDict,
} from 'matrix-js-sdk';
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api/CryptoEvent.js';
import { VerificationRequestEvent, VerifierEvent } from 'matrix-js-sdk/lib/crypto-api/verification.js';
import { KnownMembership } from 'matrix-js-sdk/lib/@types/membership.js';
import type { Logger as MatrixLogger } from 'matrix-js-sdk/lib/logger.js';
import { MatrixConfig } from './interfaces';
import { AppLogger } from '@w3f/polguard-common';

/** Adapts a pino-style AppLogger to the matrix-js-sdk Logger interface */
function createMatrixLogger(pinoLogger: AppLogger): MatrixLogger {
  const adapter: MatrixLogger = {
    trace: (...msg: any[]) => pinoLogger.trace(msg.join(' ')),
    debug: (...msg: any[]) => pinoLogger.debug(msg.join(' ')),
    info: (...msg: any[]) => pinoLogger.info(msg.join(' ')),
    warn: (...msg: any[]) => pinoLogger.warn(msg.join(' ')),
    error: (...msg: any[]) => pinoLogger.error(msg.join(' ')),
    getChild(_namespace: string): MatrixLogger {
      return createMatrixLogger(pinoLogger);
    },
  };
  return adapter;
}

export class MatrixClient {
  protected client: SDKMatrixClient;
  protected config: MatrixConfig;
  protected logger: AppLogger;

  constructor(config: MatrixConfig, logger: AppLogger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * The auth type is the encryption switch: password auth always runs encrypted;
   * token auth runs plaintext for simple client-server API reads.
   */
  private get encryptionEnabled(): boolean {
    return !!this.config.passwordAuth;
  }

  async init() {
    this.client = await this.createClient();
    if (this.encryptionEnabled) {
      await this.pruneOtherDevices();
    }
    await this.setupClientAndSync();
    this.setupEventHandlers();

    const rooms = this.client.getRooms();
    this.logger.info(`Matrix client initialized successfully. Bot is in ${rooms.length} rooms:`);
    rooms.forEach(room => {
      this.logger.info(`  - Room: ${room.roomId} (${room.name || 'No name'})`);
    });
  }

  private async setupClientAndSync(): Promise<void> {
    if (this.encryptionEnabled) {
      await this.client.initRustCrypto({ useIndexedDB: false });
    }

    await this.client.startClient({ initialSyncLimit: 10 });
    await this.waitForSync();
  }

  private setupEventHandlers(): void {
    this.setupMessageHandler();
    if (this.encryptionEnabled) {
      this.setupVerificationHandler();
    }

    this.setupAutoJoinHandler();
  }

  private async createClient(): Promise<SDKMatrixClient> {
    // Token auth (CI/e2e): use the supplied credentials as-is, no login, no crypto.
    if (this.config.tokenAuth) {
      return this.createClientWithToken(
        this.config.userId,
        this.config.tokenAuth.deviceId,
        this.config.tokenAuth.accessToken,
      );
    }

    const { newAccessToken, newDeviceId } = await this.performLogin();
    return this.createClientWithToken(this.config.userId, newDeviceId, newAccessToken);
  }

  private async performLogin(): Promise<{ newAccessToken: string; newDeviceId: string }> {
    const loginClient = createClient({ baseUrl: this.config.url });
    try {
      const response = await loginClient.login('m.login.password', {
        user: this.config.userId,
        password: this.config.passwordAuth.password,
      });
      return {
        newAccessToken: response.access_token,
        newDeviceId: response.device_id,
      };
    } finally {
      loginClient.stopClient();
    }
  }

  private createClientWithToken(userId: string, deviceId: string, accessToken: string): SDKMatrixClient {
    const options: ICreateClientOpts = {
      baseUrl: this.config.url,
      accessToken,
      userId,
      deviceId,
      logger: createMatrixLogger(this.logger),
    };

    return createClient(options);
  }

  /**
   * Deletes the bot's other devices, keeping only the current session.
   *
   * Because the in-memory crypto store forces a fresh login (and a new device) on
   * every restart, old devices would otherwise pile up on the account and each show as an
   * unverified device. Pruning them keeps a single active device. Best-effort: a failure
   * here must never block startup.
   */
  private async pruneOtherDevices(): Promise<void> {
    try {
      const currentDeviceId = this.client.getDeviceId();
      const { devices } = await this.client.getDevices();
      const staleIds = devices.map(d => d.device_id).filter(id => id && id !== currentDeviceId);
      if (staleIds.length === 0) {
        return;
      }

      const auth: AuthDict = {
        type: 'm.login.password',
        identifier: { type: 'm.id.user', user: this.config.userId },
        password: this.config.passwordAuth.password,
      };

      try {
        await this.client.deleteMultipleDevices(staleIds, auth);
      } catch (err) {
        const session = err instanceof MatrixError ? (err.data?.session as string | undefined) : undefined;
        if (!session) {
          throw err;
        }
        await this.client.deleteMultipleDevices(staleIds, { ...auth, session });
      }

      this.logger.info(`Pruned ${staleIds.length} stale Matrix device(s)`);
    } catch (err) {
      this.logger.warn(`Failed to prune old Matrix devices: ${err}`);
    }
  }

  private async waitForSync(): Promise<void> {
    return new Promise(resolve => {
      this.client.once(ClientEvent.Sync, (state: string) => {
        this.logger.debug(`Matrix client sync state: ${state}`);
        if (state === 'PREPARED') {
          this.logger.info('Matrix client sync completed - ready to receive messages');
          resolve();
        }
      });
    });
  }

  private setupMessageHandler(): void {
    this.logger.debug('Setting up Matrix message handler for Timeline events');
    this.client.on(RoomEvent.Timeline, (event: MatrixEvent, room: Room) => {
      this.logger.debug(
        `Timeline event received: type=${event.getType()}, room=${room.roomId}, sender=${event.getSender()}`,
      );
      if (event.getType() === 'm.room.message' || event.getType() === 'm.room.encrypted') {
        this.handleIncomingMessage(event, room);
      }
    });
    this.logger.debug('Matrix message handler setup complete');
  }

  protected async handleIncomingMessage(event: MatrixEvent, room: Room) {
    const sender = event.getSender();
    const roomId = room.roomId;
    const eventType = event.getType();

    this.logger.debug(`MatrixClient processing ${eventType} from ${sender} in room ${roomId}`);

    if (sender === this.client.getUserId()) {
      this.logger.debug('Ignoring message from bot itself');
      return;
    }

    // Decrypt the event if it's encrypted
    if (event.isEncrypted()) {
      this.logger.debug('Decrypting encrypted message...');
      await this.client.decryptEventIfNeeded(event);
    }

    const content = event.getContent();
    const body = content.body || '';

    this.logger.debug(`Message body: "${body}"`);

    if (!body) {
      this.logger.debug('Message body is empty');
      return;
    }

    if (body.startsWith('!')) {
      this.logger.debug(`Detected command: ${body}`);
      this.handleCommand(roomId, body, event);
    } else {
      this.logger.debug(`Non-command message: ${body}`);
    }
  }

  /**
   * Handles incoming room commands (messages starting with '!').
   *
   * This is a placeholder method in the base class, designed to be
   * overridden by subclasses for specific command handling logic.
   * It allows for easy extension of functionality in derived classes
   * without modifying the base MatrixClient implementation.
   *
   * @param roomId The ID of the room where the command was received
   * @param command The full command string, including the leading '!'
   * @param event The original Matrix event object
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected handleCommand(roomId: string, command: string, event?: MatrixEvent) {
    // Default implementation does nothing
    // Subclasses should override this method to provide command handling
  }

  /**
   * Sets up a listener for incoming verification requests.
   *
   * This method implements a session verification (cross-signing) process using
   * the Short Authentication String (SAS) method. It's currently the most
   * straightforward way to verify a session, but it requires interaction from
   * another verified session.
   *
   * Limitations:
   * - Requires another verified session to initiate the verification process.
   * - In its current form, it auto-accepts and auto-confirms, which isn't
   *   secure for real-world applications.
   *
   * Alternative approach:
   * An alternative method could involve using a private key to verify the session.
   * This would allow for automatic verification without requiring interaction
   * from another session. However, this approach:
   * - Requires secure management of private keys.
   * - May not be directly supported by all Matrix client SDKs.
   * - Could have different security implications that need to be considered.
   */
  private setupVerificationHandler() {
    this.client.on(CryptoEvent.VerificationRequestReceived, async request => {
      try {
        await request.accept();
        request.on(VerificationRequestEvent.Change, async () => {
          const verifier = await request.startVerification('m.sas.v1');
          verifier.on(VerifierEvent.ShowSas, e => {
            this.logger.info(`Verification SAS: ${e.sas.emoji.join(', ')}`);
            e.confirm();
          });
          verifier.on(VerifierEvent.Cancel, error => {
            this.logger.error(`Verification cancelled: ${error}`);
          });
        });
      } catch (error) {
        this.logger.error(`Error handling verification request: ${error}`);
      }
    });
  }

  private setupAutoJoinHandler() {
    this.client.on(RoomEvent.MyMembership, (room, membership /*, prevMembership*/) => {
      if (membership === KnownMembership.Invite) {
        this.client
          .joinRoom(room.roomId)
          .then(() => this.logger.info(`Auto-joined ${room.roomId}`))
          .catch(err => this.logger.error(`Auto-join failed for ${room.roomId}:`, err));
      }
    });
  }

  public async sendMessage(roomId: string, message: string) {
    const content: any = {
      msgtype: MsgType.Text,
      body: message,
      format: 'org.matrix.custom.html',
      formatted_body: message,
    };

    await this.client.sendMessage(roomId, content);
    this.logger.debug(`Sent message to room ${roomId}`);
  }

  public async stop() {
    if (this.client) {
      this.client.stopClient();
      this.logger.info('Matrix client stopped');
    }
  }
}
