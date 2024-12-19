import * as olm from '@matrix-org/olm';
import {
  MatrixClient as SDKMatrixClient,
  createClient,
  ClientEvent,
  MatrixEvent,
  Room,
  RoomEvent,
  MsgType,
  CryptoEvent,
} from 'matrix-js-sdk';
import { VerificationRequestEvent, VerifierEvent } from 'matrix-js-sdk/lib/crypto-api/verification';
import { KnownMembership } from 'matrix-js-sdk/lib/@types/membership.js';
import { logger as matrixLogger } from 'matrix-js-sdk/lib/logger';
import { LocalStorageCryptoStore } from 'matrix-js-sdk/lib/crypto/store/localStorage-crypto-store';
import { LocalStorage } from 'node-localstorage';
import { MatrixConfig } from './interfaces';
import { Logger } from '@w3f/monitoring-types';

export class MatrixClient {
  protected client: SDKMatrixClient;
  protected config: MatrixConfig;
  protected logger: Logger;
  protected localStorage: LocalStorage;

  constructor(config: MatrixConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.localStorage = new LocalStorage('matrix-storage');
  }

  async init() {
    try {
      global.Olm = olm;
      this.client = await this.createClient();
      await this.setupClientAndSync();
      this.setupEventHandlers();
      this.logger.log('Matrix client initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Matrix client: ${error.message}`);
      throw error;
    }
  }

  private async setupClientAndSync(): Promise<void> {
    await this.client.initCrypto();
    this.client.setGlobalErrorOnUnknownDevices(false);
    await this.client.startClient({ initialSyncLimit: 10 });
    await this.waitForSync();
  }

  private setupEventHandlers(): void {
    this.setupMessageHandler();
    this.setupVerificationHandler();
    this.setupAutoJoinHandler();
  }

  private async createClient(): Promise<SDKMatrixClient> {
    const { accessToken, deviceId } = this.getCredentials();

    if (accessToken && deviceId) {
      return this.createClientWithToken(accessToken, deviceId);
    }

    const { newAccessToken, newDeviceId } = await this.performLogin();
    await this.storeCredentials(newAccessToken, newDeviceId);
    return this.createClientWithToken(newAccessToken, newDeviceId);
  }

  private async performLogin(): Promise<{ newAccessToken: string; newDeviceId: string }> {
    const loginClient = createClient({ baseUrl: this.config.serverAddress });
    try {
      const response = await loginClient.login('m.login.password', {
        user: this.config.userId,
        password: this.config.password,
      });
      return {
        newAccessToken: response.access_token,
        newDeviceId: response.device_id,
      };
    } finally {
      loginClient.stopClient();
    }
  }

  private getCredentials(): { accessToken: string | null; deviceId: string | null } {
    return {
      accessToken: this.localStorage.getItem(`token-${this.config.userId}`),
      deviceId: this.localStorage.getItem(`device-${this.config.userId}`),
    };
  }

  private async storeCredentials(accessToken: string, deviceId: string): Promise<void> {
    this.localStorage.setItem(`token-${this.config.userId}`, accessToken);
    this.localStorage.setItem(`device-${this.config.userId}`, deviceId);
  }

  private createClientWithToken(accessToken: string, deviceId: string): SDKMatrixClient {
    const cryptoStore = new LocalStorageCryptoStore(this.localStorage);
    matrixLogger.setDefaultLevel(this.config.logging.level);

    return createClient({
      baseUrl: this.config.serverAddress,
      accessToken,
      userId: this.config.userId,
      deviceId,
      cryptoStore,
      logger: matrixLogger,
    });
  }

  private async waitForSync(): Promise<void> {
    return new Promise(resolve => {
      this.client.once(ClientEvent.Sync, (state: string) => {
        if (state === 'PREPARED') {
          resolve();
        }
      });
    });
  }

  private setupMessageHandler(): void {
    this.client.on(RoomEvent.Timeline, (event: MatrixEvent, room: Room) => {
      if (event.getType() === 'm.room.message') {
        this.handleIncomingMessage(event, room);
      }
    });
  }

  protected handleIncomingMessage(event: MatrixEvent, room: Room) {
    const sender = event.getSender();
    const content = event.getContent();
    this.logger.debug(`Received message from ${sender} in room ${room.roomId}: ${content.body}`);

    if (content.body.startsWith('!')) {
      this.handleCommand(room.roomId, content.body);
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
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected handleCommand(roomId: string, command: string) {
    // TODO: Implement it.
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
            this.logger.log(`Verification SAS: ${e.sas.emoji.join(', ')}`);
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.client.on(RoomEvent.MyMembership, function (room, membership, prevMembership) {
      if (membership === KnownMembership.Invite) {
        this.client.joinRoom(room.roomId).then(function () {
          console.log('Auto-joined %s', room.roomId);
        });
      }
    });
  }

  public async sendMessage(roomId: string, message: string) {
    try {
      const content: any = {
        msgtype: MsgType.Text,
        body: message,
        format: 'org.matrix.custom.html',
        formatted_body: message,
      };

      await this.client.sendMessage(roomId, content);
      this.logger.debug(`Sent message to room ${roomId}`);
    } catch (error) {
      this.logger.error(`Failed to send message to room ${roomId}: ${error.message}`);
      throw error;
    }
  }

  public async stop() {
    if (this.client) {
      this.client.stopClient();
      this.logger.log('Matrix client stopped');
    }
  }
}
