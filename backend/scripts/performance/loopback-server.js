const fs = require('fs');
const http = require('http');
const path = require('path');
const { app } = require('../../dist/src/app');
const { closeDbPool } = require('../../dist/src/config/db');

const port = Number(process.env.PORT);
const readyFile = process.env.PERFORMANCE_READY_FILE;

if (!Number.isInteger(port) || port < 1 || port > 65535 || !readyFile) {
  throw new Error('PORT and PERFORMANCE_READY_FILE are required');
}

const server = http.createServer(app);
let shuttingDown = false;

server.listen(port, '127.0.0.1', () => {
  const address = server.address();
  if (!address || typeof address === 'string' || address.address !== '127.0.0.1') {
    throw new Error('Performance server did not bind to 127.0.0.1');
  }
  fs.writeFileSync(
    readyFile,
    JSON.stringify({ address: address.address, port: address.port })
  );
});

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close(async (error) => {
    try {
      await closeDbPool();
    } finally {
      if (error) process.exitCode = 1;
      process.exit();
    }
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
