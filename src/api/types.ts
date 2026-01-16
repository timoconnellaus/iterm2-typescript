import type { ConnectionOptions } from '../core/connection';

export type { ConnectionOptions };

export type SplitDirection = 'vertical' | 'horizontal';

export interface SplitOptions {
  /** Profile name to use for the new session */
  profile?: string;
  /** If true, new pane appears before (left/above) the current one */
  before?: boolean;
}

export interface SendTextOptions {
  /** If true, don't broadcast to other sessions in broadcast mode */
  suppressBroadcast?: boolean;
}

export interface BufferOptions {
  /** First line to retrieve (0 = first visible line, negative = scrollback) */
  startLine?: number;
  /** Number of lines to retrieve */
  lineCount?: number;
}

export interface ActivateOptions {
  /** Also select the containing tab */
  selectTab?: boolean;
  /** Also bring the window to front */
  orderWindowFront?: boolean;
}

export interface CloseOptions {
  /** Force close without confirmation */
  force?: boolean;
}

export interface CreateTabOptions {
  /** Profile name for the new tab */
  profile?: string;
  /** Index to insert the tab at */
  index?: number;
  /** Command to run in the new tab */
  command?: string;
}

export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}
