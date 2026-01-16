import { Connection, type ConnectionOptions } from '../core/connection';
import type {
  ListSessionsResponse_Window,
  ListSessionsResponse_Tab,
  SplitTreeNode,
} from '../generated/api';
import { Window } from './Window';
import { Tab } from './Tab';
import { Session, ActiveSession } from './Session';

/**
 * Extract all session IDs from a SplitTreeNode recursively.
 */
function extractSessionIds(node: SplitTreeNode | undefined): string[] {
  if (!node) return [];

  const sessionIds: string[] = [];

  for (const link of node.links || []) {
    if (link.child?.$case === 'session' && link.child.session.uniqueIdentifier) {
      sessionIds.push(link.child.session.uniqueIdentifier);
    } else if (link.child?.$case === 'node') {
      sessionIds.push(...extractSessionIds(link.child.node));
    }
  }

  return sessionIds;
}

/**
 * Main entry point for the iTerm2 API.
 */
export class App {
  private connection: Connection;
  private _windows: Window[] = [];

  private constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Connect to iTerm2 and return an App instance.
   */
  static async connect(options?: ConnectionOptions): Promise<App> {
    const connection = new Connection(options);
    await connection.connect();

    const app = new App(connection);
    await app.refresh();

    return app;
  }

  /**
   * Get all windows.
   */
  get windows(): Window[] {
    return this._windows;
  }

  /**
   * Get the current window (first window, if any).
   */
  get currentWindow(): Window | undefined {
    return this._windows[0];
  }

  /**
   * Get a session that always refers to the currently active session.
   * Operations on this session will target whatever session has focus.
   */
  get currentSession(): ActiveSession {
    return new ActiveSession(this.connection);
  }

  /**
   * Refresh the app state from iTerm2.
   */
  async refresh(): Promise<void> {
    const response = await this.connection.send({
      submessage: {
        $case: 'listSessionsRequest',
        listSessionsRequest: {},
      },
    });

    if (response.submessage?.$case === 'listSessionsResponse') {
      const listResponse = response.submessage.listSessionsResponse;
      this._windows = this.parseWindows(listResponse.windows || []);
    }
  }

  private parseWindows(protoWindows: ListSessionsResponse_Window[]): Window[] {
    return protoWindows.map((pw) => {
      const tabs = this.parseTabs(pw.tabs || []);
      return new Window(this.connection, pw.windowId || '', tabs);
    });
  }

  private parseTabs(protoTabs: ListSessionsResponse_Tab[]): Tab[] {
    return protoTabs.map((pt) => {
      const sessionIds = extractSessionIds(pt.root);
      return new Tab(this.connection, pt.tabId || '', sessionIds);
    });
  }

  /**
   * Create a new window.
   */
  async createWindow(options: { profile?: string } = {}): Promise<{ window: Window; tab: Tab; session: Session }> {
    const response = await this.connection.send({
      submessage: {
        $case: 'createTabRequest',
        createTabRequest: {
          profileName: options.profile,
          customProfileProperties: [],
        },
      },
    });

    if (response.submessage?.$case === 'createTabResponse') {
      const createResponse = response.submessage.createTabResponse;

      const windowId = createResponse.windowId;
      const tabId = createResponse.tabId?.toString();
      const sessionId = createResponse.sessionId;

      if (!windowId || !tabId || !sessionId) {
        throw new Error('Window created but missing IDs');
      }

      const session = new Session(this.connection, sessionId);
      const tab = new Tab(this.connection, tabId, [sessionId]);
      const window = new Window(this.connection, windowId, [tab]);

      return { window, tab, session };
    }

    throw new Error('Unexpected response type');
  }

  /**
   * Disconnect from iTerm2.
   */
  disconnect(): void {
    this.connection.disconnect();
  }
}
