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
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api/recovery-key.js';
import type { Logger as MatrixLogger } from 'matrix-js-sdk/lib/logger.js';
import { logger as matrixGlobalLogger } from 'matrix-js-sdk/lib/logger.js';
import { Tracing, LoggerLevel } from '@matrix-org/matrix-sdk-crypto-wasm';
import { MatrixConfig } from './interfaces';
import { AppLogger } from '@w3f/polguard-common';

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

type LoglevelMethod = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/**
 * The public matrix-js-sdk `Logger` type doesn't expose `methodFactory`/`rebuild`, but the
 * exported global `logger` is really a `loglevel` instance underneath, and overriding its
 * `methodFactory` (then rebuilding) is the SDK's own supported way to redirect its output -
 * the same mechanism `Logger.getChild` uses internally to propagate custom factories.
 */
interface LoglevelLogger {
  methodFactory: (methodName: LoglevelMethod, logLevel: number, loggerName: string) => (...args: unknown[]) => void;
  rebuild(): void;
}

export class MatrixClient {
  protected client: SDKMatrixClient;
  protected config: MatrixConfig;
  protected logger: AppLogger;
  private sdkLogger: AppLogger;

  constructor(config: MatrixConfig, logger: AppLogger) {
    this.config = config;
    this.logger = logger;
    this.sdkLogger = this.logger.child?.({ context: 'MatrixSDK' }, { level: this.config.logging.level }) ?? logger;
    this.installGlobalLoggerOverride();
  }

  /**
   * matrix-js-sdk falls back to its own global default logger (writing straight to console)
   * whenever a client isn't given an explicit `logger` option (e.g. the internal login client),
   * and some internal modules (decrypt-error logging, MatrixRTCSession) use that global logger
   * directly regardless. Redirecting it here is the only way to gate those under `matrix.logging.level`.
   */
  private installGlobalLoggerOverride(): void {
    const loglevelLogger = matrixGlobalLogger as unknown as LoglevelLogger;
    loglevelLogger.methodFactory = (methodName: LoglevelMethod) => {
      return (...args: unknown[]) => this.sdkLogger[methodName](args.map(String).join(' '));
    };
    loglevelLogger.rebuild();
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
    if (this.encryptionEnabled && this.config.pruneOtherDevices) {
      await this.pruneOtherDevices();
    }
    await this.setupClientAndSync();
    this.setupMessageHandler();

    const rooms = this.client.getRooms();
    this.logger.info(`Matrix client initialized successfully. Bot is in ${rooms.length} rooms:`);
    rooms.forEach(room => {
      this.logger.info(`  - Room: ${room.roomId} (${room.name || 'No name'})`);
    });
  }

  private async setupClientAndSync(): Promise<void> {
    if (this.encryptionEnabled) {
      this.installCryptoTracing();
      await this.client.initRustCrypto({ useIndexedDB: false });
    }

    await this.client.startClient({ initialSyncLimit: 10 });
    await this.waitForSync();

    if (this.encryptionEnabled && this.config.passwordAuth?.recoveryKey) {
      await this.ensureCrossSigning();
    }
  }

  /**
   * Cross-signs the current device using the cross-signing keys held in the
   * account's Secret Storage (unlocked via the configured recovery key).
   */
  private async ensureCrossSigning(): Promise<void> {
    try {
      const crypto = this.client.getCrypto();
      if (!crypto) {
        return;
      }

      const hasIdentity = await crypto.userHasCrossSigningKeys(this.config.userId, true);
      if (!hasIdentity) {
        this.logger.warn('Account has no cross-signing identity; device stays unverified');
        return;
      }

      await crypto.bootstrapCrossSigning({
        authUploadDeviceSigningKeys: async makeRequest => {
          await makeRequest({
            type: 'm.login.password',
            identifier: { type: 'm.id.user', user: this.config.userId },
            password: this.config.passwordAuth.password,
          });
        },
      });

      // The device's verification status settles asynchronously, so we don't
      // read it back here (it would still report unsigned right after signing).
      const deviceId = this.client.getDeviceId();
      await crypto.crossSignDevice(deviceId);
      this.logger.info(`Cross-signed Matrix device ${deviceId}`);
    } catch (err) {
      this.logger.warn(`Failed to cross-sign Matrix device: ${err}`);
    }
  }

  private async createClient(): Promise<SDKMatrixClient> {
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

  /**
   * The Rust crypto layer writes straight to console.* (no pino hook available),
   * so this only bounds its volume/severity, not its formatting.
   */
  private installCryptoTracing(): void {
    const level = this.config.logging.level;
    const loggerLevel = LoggerLevel[(level.charAt(0).toUpperCase() + level.slice(1)) as keyof typeof LoggerLevel];
    new Tracing(loggerLevel);
  }

  private createClientWithToken(userId: string, deviceId: string, accessToken: string): SDKMatrixClient {
    const recoveryKey = this.config.passwordAuth?.recoveryKey;
    const options: ICreateClientOpts = {
      baseUrl: this.config.url,
      accessToken,
      userId,
      deviceId,
      logger: createMatrixLogger(this.sdkLogger),
      cryptoCallbacks: recoveryKey
        ? {
            getSecretStorageKey: async ({ keys }) => {
              const defaultKeyId = await this.client.secretStorage.getDefaultKeyId();
              const keyId = defaultKeyId && keys[defaultKeyId] ? defaultKeyId : Object.keys(keys)[0];
              return keyId ? [keyId, decodeRecoveryKey(recoveryKey)] : null;
            },
          }
        : undefined,
    };

    return createClient(options);
  }

  /**
   * Deletes the bot's other devices, keeping only the current session.
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
