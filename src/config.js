const path = require('path');

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`${name} must be an integer`);
  }
  return parsed;
}

function loadConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';

  return {
    port: intEnv('PORT', 3000),
    nodeEnv,
    encryptionKey: process.env.ENCRYPTION_KEY || '',
    auditLogPath:
      process.env.AUDIT_LOG_PATH ||
      path.join(__dirname, '..', 'data', 'audit-log.json'),
    circuit: {
      failureThreshold: intEnv('CIRCUIT_FAILURE_THRESHOLD', 3),
      resetTimeoutMs: intEnv('CIRCUIT_RESET_MS', 30000),
    },
    ai: {
      delayMs: intEnv('AI_DELAY_MS', 2000),
    },
  };
}

module.exports = { loadConfig };
