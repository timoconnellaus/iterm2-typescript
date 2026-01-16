import WebSocket from 'ws';
import { existsSync, symlinkSync, unlinkSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import {
  ClientOriginatedMessage,
  ServerOriginatedMessage,
  Notification,
} from '../generated/api';

const ITERM2_WEBSOCKET_URL = 'ws://localhost:1912';
const ITERM2_UNIX_SOCKET_PATH = join(
  homedir(),
  'Library/Application Support/iTerm2/private/socket'
);
const SUBPROTOCOL = 'api.iterm2.com';

/**
 * Create a symlink to the socket in a path without spaces.
 * This works around a bug in the ws library where paths with spaces
 * get URL-encoded and fail to connect.
 */
function createSocketSymlink(socketPath: string): string {
  const symlinkPath = join(tmpdir(), `iterm2-socket-${process.pid}`);
  if (existsSync(symlinkPath)) {
    unlinkSync(symlinkPath);
  }
  symlinkSync(socketPath, symlinkPath);
  return symlinkPath;
}

export interface ConnectionOptions {
  /** Custom cookie for authentication (defaults to ITERM2_COOKIE env var) */
  cookie?: string;
  /** Custom key for session correlation (defaults to ITERM2_KEY env var) */
  key?: string;
  /** Advisory name shown in iTerm2 scripting console */
  advisoryName?: string;
  /** Library version string */
  libraryVersion?: string;
}

export type NotificationHandler = (notification: Notification) => void;

interface PendingRequest {
  resolve: (message: ServerOriginatedMessage) => void;
  reject: (error: Error) => void;
}

export class Connection {
  private ws: WebSocket | null = null;
  private messageId = BigInt(0);
  private pendingRequests = new Map<string, PendingRequest>();
  private notificationHandlers = new Set<NotificationHandler>();
  private options: ConnectionOptions;
  private connectionPromise: Promise<void> | null = null;
  private socketSymlinkPath: string | null = null;

  constructor(options: ConnectionOptions = {}) {
    this.options = {
      cookie: options.cookie ?? process.env.ITERM2_COOKIE,
      key: options.key ?? process.env.ITERM2_KEY,
      advisoryName: options.advisoryName ?? 'iterm2-typescript',
      libraryVersion: options.libraryVersion ?? 'typescript 0.1.0',
    };
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      origin: 'ws://localhost/',
      'x-iterm2-library-version': this.options.libraryVersion!,
      'x-iterm2-disable-auth-ui': 'false',
      'x-iterm2-advisory-name': this.options.advisoryName!,
    };

    if (this.options.cookie) {
      headers['x-iterm2-cookie'] = this.options.cookie;
    }
    if (this.options.key) {
      headers['x-iterm2-key'] = this.options.key;
    }

    return headers;
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      // Prefer Unix socket if available, fall back to TCP
      const useUnixSocket = existsSync(ITERM2_UNIX_SOCKET_PATH);

      let url: string;
      if (useUnixSocket) {
        // Create a symlink to work around ws library bug with spaces in paths
        this.socketSymlinkPath = createSocketSymlink(ITERM2_UNIX_SOCKET_PATH);
        url = `ws+unix://${this.socketSymlinkPath}:/`;
      } else {
        url = ITERM2_WEBSOCKET_URL;
      }

      this.ws = new WebSocket(url, [SUBPROTOCOL], {
        headers: this.getHeaders(),
      });

      this.ws.binaryType = 'arraybuffer';

      this.ws.on('open', () => {
        this.connectionPromise = null;
        resolve();
      });

      this.ws.on('message', (data: ArrayBuffer) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (error) => {
        this.connectionPromise = null;
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        this.connectionPromise = null;
        this.handleClose(code, reason.toString());
      });
    });

    return this.connectionPromise;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Clean up socket symlink
    if (this.socketSymlinkPath && existsSync(this.socketSymlinkPath)) {
      try {
        unlinkSync(this.socketSymlinkPath);
      } catch {
        // Ignore cleanup errors
      }
      this.socketSymlinkPath = null;
    }

    // Reject all pending requests
    for (const pending of this.pendingRequests.values()) {
      pending.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private nextMessageId(): string {
    this.messageId += BigInt(1);
    return this.messageId.toString();
  }

  async send(message: ClientOriginatedMessage): Promise<ServerOriginatedMessage> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to iTerm2');
    }

    const id = this.nextMessageId();
    const messageWithId: ClientOriginatedMessage = { ...message, id };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const encoded = ClientOriginatedMessage.encode(messageWithId).finish();
      this.ws!.send(encoded, (error) => {
        if (error) {
          this.pendingRequests.delete(id);
          reject(error);
        }
      });
    });
  }

  private handleMessage(data: ArrayBuffer): void {
    const bytes = new Uint8Array(data);
    const message = ServerOriginatedMessage.decode(bytes);

    // Check if this is a response to a pending request
    if (message.id && message.id !== '0') {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        pending.resolve(message);
        return;
      }
    }

    // Check if this is a notification (spontaneous message with no ID)
    if (message.submessage?.$case === 'notification') {
      const notification = message.submessage.notification;
      for (const handler of this.notificationHandlers) {
        try {
          handler(notification);
        } catch (error) {
          console.error('Notification handler error:', error);
        }
      }
    }
  }

  private handleClose(code: number, reason: string): void {
    // Reject all pending requests
    const error = new Error(`Connection closed: ${code} ${reason}`);
    for (const pending of this.pendingRequests.values()) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  onNotification(handler: NotificationHandler): () => void {
    this.notificationHandlers.add(handler);
    return () => {
      this.notificationHandlers.delete(handler);
    };
  }
}
