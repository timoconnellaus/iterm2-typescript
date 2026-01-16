# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

Use `bun` as the package manager and runtime for all commands.

## Commands

```bash
bun run build           # Build with tsup (cjs, esm, dts)
bun run typecheck       # Type check without emitting
bun run test            # Run all tests
bun run test:integration # Run integration tests (requires iTerm2 with API enabled)
bun run proto:generate  # Regenerate TypeScript from proto/api.proto
```

Run a single test file:
```bash
bun vitest run tests/integration/connection.test.ts
```

## Architecture

This library provides a TypeScript API for controlling iTerm2 via its WebSocket API.

### Protocol Layer
- `proto/api.proto` - iTerm2's protobuf API definition (copied from iTerm2 source)
- `src/generated/api.ts` - Auto-generated TypeScript types from proto (do not edit manually)
- Uses `ts-proto` with discriminated unions (`$case` pattern) for oneof fields

### Connection Layer
- `src/core/connection.ts` - WebSocket connection to iTerm2
- Connects via Unix socket (`~/Library/Application Support/iTerm2/private/socket`) or TCP fallback (port 1912)
- Uses symlink workaround for ws library bug with spaces in socket path
- Request/response correlation via message IDs
- Notification handling for spontaneous server messages

### Message Protocol
All messages use protobuf binary encoding:
- Client sends `ClientOriginatedMessage` with unique `id` and a `submessage` (request type)
- Server responds with `ServerOriginatedMessage` with matching `id` and corresponding response
- Notifications arrive with `submessage.$case === 'notification'` and no `id`

### Authentication
Connection headers read from environment variables:
- `ITERM2_COOKIE` - Authentication cookie
- `ITERM2_KEY` - Session correlation key

### High-Level API
- `src/api/App.ts` - Entry point, manages connection and window hierarchy
- `src/api/Session.ts` - Terminal pane operations (sendText, split, activate, close)
- `src/api/Window.ts` - Window operations (createTab, activate, close)
- `src/api/Tab.ts` - Tab operations (activate, close)
- `src/api/types.ts` - Clean TypeScript types for options

Usage:
```typescript
import { App } from 'iterm2';

const app = await App.connect();
const session = app.currentSession;
await session.sendText('ls -la\n');
const newSession = await session.splitVertical();
app.disconnect();
```

The low-level proto types are still exported for advanced usage.

## Reference

The official iTerm2 repository is cloned at `/tmp/iterm2-repo` for reference. The Python API implementation at `/tmp/iterm2-repo/api/library/python/iterm2/iterm2/` shows patterns for the higher-level API.
