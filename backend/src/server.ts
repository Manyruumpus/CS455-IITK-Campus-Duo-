import { createApp } from './app';
import { getEnvConfig } from './config/env';
import { closeDbPool } from './config/db';

const config = getEnvConfig();
const app = createApp();

const loopbackHosts = new Set(['127.0.0.1', '::1', 'localhost']);
if (config.allowTestHarnessAuth && !loopbackHosts.has(config.host.toLowerCase())) {
  throw new Error('ALLOW_TEST_HARNESS_AUTH requires a loopback HOST (127.0.0.1, ::1, or localhost)');
}

const server = app.listen(config.port, config.host, () => {
  console.log(`Campus Duo booking server running on ${config.host}:${config.port} (${config.nodeEnv})`);
});

async function handleShutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, gracefully shutting down...`);
  server.close(async () => {
    try {
      await closeDbPool();
      console.log('Database pool closed. Server exit clean.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown', err);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
