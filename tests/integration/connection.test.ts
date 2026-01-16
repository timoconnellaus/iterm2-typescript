import { describe, it, expect, afterEach } from 'vitest';
import { Connection, ListSessionsRequest } from '../../src';

describe('Connection', () => {
  let connection: Connection;

  afterEach(() => {
    connection?.disconnect();
  });

  it('should connect to iTerm2', async () => {
    connection = new Connection();
    await connection.connect();
    expect(connection.isConnected).toBe(true);
  });

  it('should list sessions', async () => {
    connection = new Connection();
    await connection.connect();

    const response = await connection.send({
      submessage: {
        $case: 'listSessionsRequest',
        listSessionsRequest: ListSessionsRequest.create(),
      },
    });

    expect(response.submessage?.$case).toBe('listSessionsResponse');
    if (response.submessage?.$case === 'listSessionsResponse') {
      // Should have at least one window (the one running this test)
      expect(response.submessage.listSessionsResponse.windows?.length).toBeGreaterThan(0);
    }
  });

  it('should disconnect cleanly', async () => {
    connection = new Connection();
    await connection.connect();
    expect(connection.isConnected).toBe(true);

    connection.disconnect();
    expect(connection.isConnected).toBe(false);
  });
});
