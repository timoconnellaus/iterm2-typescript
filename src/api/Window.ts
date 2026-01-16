import type { Connection } from '../core/connection';
import {
  ActivateResponse_Status,
  CloseResponse_Status,
  CreateTabResponse_Status,
} from '../generated/api';
import { Tab } from './Tab';
import { Session } from './Session';
import type { CloseOptions, CreateTabOptions } from './types';

function hasCloseError(statuses: CloseResponse_Status[] | undefined): boolean {
  return statuses?.some((s) => s === CloseResponse_Status.NOT_FOUND) ?? false;
}

export class Window {
  readonly id: string;
  private connection: Connection;
  private _tabs: Tab[] = [];

  constructor(connection: Connection, id: string, tabs: Tab[] = []) {
    this.connection = connection;
    this.id = id;
    this._tabs = tabs;
  }

  /**
   * Get all tabs in this window.
   */
  get tabs(): Tab[] {
    return this._tabs;
  }

  /**
   * Create a new tab in this window.
   */
  async createTab(options: CreateTabOptions = {}): Promise<{ tab: Tab; session: Session }> {
    const response = await this.connection.send({
      submessage: {
        $case: 'createTabRequest',
        createTabRequest: {
          windowId: this.id,
          profileName: options.profile,
          tabIndex: options.index,
          customProfileProperties: [],
        },
      },
    });

    if (response.submessage?.$case === 'createTabResponse') {
      const createResponse = response.submessage.createTabResponse;

      if (createResponse.status === CreateTabResponse_Status.INVALID_PROFILE_NAME) {
        throw new Error(`Invalid profile name: ${options.profile}`);
      }
      if (createResponse.status === CreateTabResponse_Status.INVALID_WINDOW_ID) {
        throw new Error(`Window not found: ${this.id}`);
      }

      const tabId = createResponse.tabId?.toString();
      const sessionId = createResponse.sessionId;

      if (!tabId || !sessionId) {
        throw new Error('Tab created but missing tab or session ID');
      }

      const session = new Session(this.connection, sessionId);
      const tab = new Tab(this.connection, tabId, [sessionId]);

      return { tab, session };
    }

    throw new Error('Unexpected response type');
  }

  /**
   * Activate this window (bring it to front).
   */
  async activate(): Promise<void> {
    const response = await this.connection.send({
      submessage: {
        $case: 'activateRequest',
        activateRequest: {
          identifier: {
            $case: 'windowId',
            windowId: this.id,
          },
          orderWindowFront: true,
        },
      },
    });

    if (response.submessage?.$case === 'activateResponse') {
      const status = response.submessage.activateResponse.status;
      if (status === ActivateResponse_Status.BAD_IDENTIFIER) {
        throw new Error(`Window not found: ${this.id}`);
      }
    }
  }

  /**
   * Close this window.
   */
  async close(options: CloseOptions = {}): Promise<void> {
    const response = await this.connection.send({
      submessage: {
        $case: 'closeRequest',
        closeRequest: {
          target: {
            $case: 'windows',
            windows: {
              windowIds: [this.id],
            },
          },
          force: options.force,
        },
      },
    });

    if (response.submessage?.$case === 'closeResponse') {
      if (hasCloseError(response.submessage.closeResponse.statuses)) {
        throw new Error(`Window not found: ${this.id}`);
      }
    }
  }
}
