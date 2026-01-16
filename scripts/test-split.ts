import { App } from '../src';

async function main() {
  console.log('Connecting to iTerm2...');
  const app = await App.connect();
  console.log('Connected!');

  console.log('Splitting pane to the right...');
  const newSession = await app.currentSession.splitVertical();
  console.log('New session ID:', newSession.id);

  console.log('Done!');
  app.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
