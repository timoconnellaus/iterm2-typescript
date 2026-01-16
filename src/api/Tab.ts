import type { Connection } from '../core/connection';
import { ActivateResponse_Status, CloseResponse_Status } from '../generated/api';
import { Session } from './Session';
import type { CloseOptions } from './types';

function hasCloseError(statuses: CloseResponse_Status[] | undefined): boolean {
  return statuses?.some((s) => s === CloseResponse_Status.NOT_FOUND) ?? false;
}

export class Tab {
  readonly id: string;
  private connection: Connection;
  private _sessions: Session[] = [];

  constructor(connection: Connection, id: string, sessionIds: string[] = []) {
    this.connection = connection;
    this.id = id;
    this._sessions = sessionIds.map((sid) => new Session(connection, sid));
  }

  /**
   * Get all sessions (panes) in this tab.
   */
  get sessions(): Session[] {
    return this._sessions;
  }

  /**
   * Activate this tab (make it the selected tab in its window).
   */
  async activate(): Promise<void> {
    const response = await this.connection.send({
      submessage: {
        $case: 'activateRequest',
        activateRequest: {
          identifier: {
            $case: 'tabId',
            tabId: this.id,
          },
          orderWindowFront: true,
        },
      },
    });

    if (response.submessage?.$case === 'activateResponse') {
      const status = response.submessage.activateResponse.status;
      if (status === ActivateResponse_Status.BAD_IDENTIFIER) {
        throw new Error(`Tab not found: ${this.id}`);
      }
    }
  }

  /**
   * Close this tab.
   */
  async close(options: CloseOptions = {}): Promise<void> {
    const response = await this.connection.send({
      submessage: {
        $case: 'closeRequest',
        closeRequest: {
          target: {
            $case: 'tabs',
            tabs: {
              tabIds: [this.id],
            },
          },
          force: options.force,
        },
      },
    });

    if (response.submessage?.$case === 'closeResponse') {
      if (hasCloseError(response.submessage.closeResponse.statuses)) {
        throw new Error(`Tab not found: ${this.id}`);
      }
    }
  }
}
