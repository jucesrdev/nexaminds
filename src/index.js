const { loadConfig } = require('./config');
const { createApp } = require('./app');
const { sanitize } = require('./services/sanitizer');
const { createMockAi } = require('./services/mockAi');
const { CircuitBreaker } = require('./services/circuitBreaker');
const { createEncryption } = require('./services/encryption');
const { createAuditLog } = require('./services/auditLog');

const config = loadConfig();

if (!config.encryptionKey) {
  throw new Error(
    'ENCRYPTION_KEY is required. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

const circuitBreaker = new CircuitBreaker(config.circuit);
const app = createApp({
  sanitizer: { sanitize },
  aiClient: createMockAi(config.ai),
  circuitBreaker,
  encryption: createEncryption(config.encryptionKey),
  auditLog: createAuditLog({ filePath: config.auditLogPath }),
});

const server = app.listen(config.port, () => {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event: 'server_started',
      port: config.port,
    })
  );
});

function shutdown(signal) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event: 'server_shutdown',
      signal,
    })
  );

  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server };
