import { Connection, SplitPaneRequest_SplitDirection } from '../src';

async function main() {
  const conn = new Connection();

  try {
    console.log('Connecting to iTerm2...');
    await conn.connect();
    console.log('Connected!');

    console.log('Splitting pane to the right...');
    const response = await conn.send({
      submessage: {
        $case: 'splitPaneRequest',
        splitPaneRequest: {
          session: 'active',
          splitDirection: SplitPaneRequest_SplitDirection.VERTICAL,
          before: false,
          customProfileProperties: [],
        },
      },
    });

    if (response.submessage?.$case === 'splitPaneResponse') {
      const splitResponse = response.submessage.splitPaneResponse;
      console.log('Split response:', splitResponse);
      if (splitResponse.sessionId && splitResponse.sessionId.length > 0) {
        console.log('New session ID:', splitResponse.sessionId[0]);
      }
    }

    console.log('Done!');
  } finally {
    conn.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
