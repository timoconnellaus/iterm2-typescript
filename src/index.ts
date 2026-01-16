// High-level API (recommended)
export { App } from './api/App';
export { Session, ActiveSession } from './api/Session';
export { Window } from './api/Window';
export { Tab } from './api/Tab';
export type {
  ConnectionOptions,
  SplitDirection,
  SplitOptions,
  SendTextOptions,
  BufferOptions,
  ActivateOptions,
  CloseOptions,
  CreateTabOptions,
  Frame,
  Size,
} from './api/types';

// Low-level API (for advanced usage)
export { Connection } from './core/connection';
export * from './generated/api';
