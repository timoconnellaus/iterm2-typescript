import type { Connection } from '../core/connection';
import {
  SplitPaneRequest_SplitDirection,
  SendTextResponse_Status,
  SplitPaneResponse_Status,
  ActivateResponse_Status,
  CloseResponse_Status,
} from '../generated/api';

function hasCloseError(statuses: CloseResponse_Status[] | undefined): boolean {
  return statuses?.some((s) => s === CloseResponse_Status.NOT_FOUND) ?? false;
}
import type {
  SplitOptions,
  SendTextOptions,
  BufferOptions,
  ActivateOptions,
  CloseOptions,
} from './types';

export class Session {
  readonly id: string;
  private connection: Connection;

  constructor(connection: Connection, id: string) {
    this.connection = connection;
    this.id = id;
  }

  /**
   * Send text to this session as if typed by the user.
   */
  async sendText(text: string, options: SendTextOptions = {}): Promise<void> {
    const response = await this.connection.send({
      submessage: {
        $case: 'sendTextRequest',
        sendTextRequest: {
          session: this.id,
          text,
          suppressBroadcast: options.suppressBroadcast,
        },
      },
    });

    if (response.submessage?.$case === 'sendTextResponse') {
      const status = response.submessage.sendTextResponse.status;
      if (status === SendTextResponse_Status.SESSION_NOT_FOUND) {
        throw new Error(`Session not found: ${this.id}`);
      }
    }
  }

  /**
   * Split this session vertically (creates a pane to the right or left).
   */
  async splitVertical(options: SplitOptions = {}): Promise<Session> {
    return this.split('vertical', options);
  }

  /**
   * Split this session horizontally (creates a pane above or below).
   */
  async splitHorizontal(options: SplitOptions = {}): Promise<Session> {
    return this.split('horizontal', options);
  }

  private async split(
    direction: 'vertical' | 'horizontal',
    options: SplitOptions
  ): Promise<Session> {
    const response = await this.connection.send({
      submessage: {
        $case: 'splitPaneRequest',
        splitPaneRequest: {
          session: this.id,
          splitDirection:
            direction === 'vertical'
              ? SplitPaneRequest_SplitDirection.VERTICAL
              : SplitPaneRequest_SplitDirection.HORIZONTAL,
          before: options.before ?? false,
          profileName: options.profile,
          customProfileProperties: [],
        },
      },
    });

    if (response.submessage?.$case === 'splitPaneResponse') {
      const splitResponse = response.submessage.splitPaneResponse;

      if (splitResponse.status === SplitPaneResponse_Status.SESSION_NOT_FOUND) {
        throw new Error(`Session not found: ${this.id}`);
      }
      if (splitResponse.status === SplitPaneResponse_Status.CANNOT_SPLIT) {
        throw new Error('Cannot split: session may be too small');
      }
      if (splitResponse.status === SplitPaneResponse_Status.INVALID_PROFILE_NAME) {
        throw new Error(`Invalid profile name: ${options.profile}`);
      }

      const newSessionId = splitResponse.sessionId?.[0];
      if (!newSessionId) {
        throw new Error('Split succeeded but no session ID returned');
      }

      return new Session(this.connection, newSessionId);
    }

    throw new Error('Unexpected response type');
  }

  /**
   * Activate this session (give it focus).
   */
  async activate(options: ActivateOptions = {}): Promise<void> {
    const response = await this.connection.send({
      submessage: {
        $case: 'activateRequest',
        activateRequest: {
          identifier: {
            $case: 'sessionId',
            sessionId: this.id,
          },
          selectTab: options.selectTab ?? true,
          orderWindowFront: options.orderWindowFront ?? true,
        },
      },
    });

    if (response.submessage?.$case === 'activateResponse') {
      const status = response.submessage.activateResponse.status;
      if (status === ActivateResponse_Status.BAD_IDENTIFIER) {
        throw new Error(`Session not found: ${this.id}`);
      }
    }
  }

  /**
   * Close this session.
   */
  async close(options: CloseOptions = {}): Promise<void> {
    const response = await this.connection.send({
      submessage: {
        $case: 'closeRequest',
        closeRequest: {
          target: {
            $case: 'sessions',
            sessions: {
              sessionIds: [this.id],
            },
          },
          force: options.force,
        },
      },
    });

    if (response.submessage?.$case === 'closeResponse') {
      if (hasCloseError(response.submessage.closeResponse.statuses)) {
        throw new Error(`Session not found: ${this.id}`);
      }
    }
  }
}

/**
 * Special session that always refers to the currently active session.
 */
export class ActiveSession extends Session {
  constructor(connection: Connection) {
    super(connection, 'active');
  }
}
