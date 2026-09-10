const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../src/app');
const { sanitize } = require('../src/services/sanitizer');
const { createMockAi } = require('../src/services/mockAi');
const { CircuitBreaker, STATES } = require('../src/services/circuitBreaker');
const { createEncryption } = require('../src/services/encryption');
const { createAuditLog } = require('../src/services/auditLog');
const { waitFor } = require('./helpers/waitFor');
const { createTestEncryptionKey } = require('./helpers/testKey');

const KEY = createTestEncryptionKey();

function buildApp({ delayMs = 20, resetTimeoutMs = 30_000 } = {}) {
  const filePath = path.join(
    os.tmpdir(),
    `inquiry-audit-${Date.now()}-${Math.random()}.json`
  );
  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 3,
    resetTimeoutMs,
  });
  const encryption = createEncryption(KEY);
  const auditLog = createAuditLog({ filePath });
  const app = createApp({
    sanitizer: { sanitize },
    aiClient: createMockAi({ delayMs }),
    circuitBreaker,
    encryption,
    auditLog,
  });

  return { app, circuitBreaker, encryption, auditLog, filePath };
}

describe('POST /secure-inquiry', () => {
  const fixtures = [];

  afterEach(async () => {
    await Promise.all(fixtures.splice(0).map((filePath) => fs.rm(filePath, { force: true })));
  });

  function setup(options) {
    const built = buildApp(options);
    fixtures.push(built.filePath);
    return built;
  }

  it('sanitizes PII, waits for the mock AI, and writes an encrypted audit record', async () => {
    const { app, encryption, auditLog } = setup();
    const original =
      'Hi, I am jane.doe@example.com paying 4111111111111111 ssn 123-45-6789';

    const response = await request(app).post('/secure-inquiry').send({
      userId: 'user-1',
      message: original,
    });

    await waitFor(() => {
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        userId: 'user-1',
        redactedMessage:
          'Hi, I am <REDACTED: EMAIL> paying <REDACTED: CREDIT_CARD> ssn <REDACTED: SSN>',
        answer: 'Generated Answer',
      });
    });

    await waitFor(async () => {
      const entries = await auditLog.readEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].redactedMessage).toBe(response.body.redactedMessage);
      expect(encryption.decrypt(entries[0].originalMessageEncrypted)).toBe(original);
      expect(JSON.stringify(entries[0].originalMessageEncrypted)).not.toContain(
        'jane.doe@example.com'
      );
    });
  });

  it('rejects invalid bodies', async () => {
    const { app } = setup();

    const missing = await request(app).post('/secure-inquiry').send({ userId: 'u1' });
    const empty = await request(app)
      .post('/secure-inquiry')
      .send({ userId: '  ', message: 'hello' });

    await waitFor(() => {
      expect(missing.status).toBe(400);
      expect(missing.body.error).toMatch(/message/);
      expect(empty.status).toBe(400);
      expect(empty.body.error).toMatch(/userId/);
    });
  });

  it('returns 502 while the circuit is still closed after an AI failure', async () => {
    const { app, circuitBreaker } = setup();

    const response = await request(app)
      .post('/secure-inquiry')
      .set('x-simulate-ai-failure', 'true')
      .send({ userId: 'user-1', message: 'hello' });

    await waitFor(() => {
      expect(response.status).toBe(502);
      expect(response.body.error).toBe('AI service unavailable');
      expect(circuitBreaker.snapshot().state).toBe(STATES.CLOSED);
      expect(circuitBreaker.snapshot().consecutiveFailures).toBe(1);
    });
  });

  it('returns Service Busy immediately after three consecutive AI failures', async () => {
    const { app, circuitBreaker } = setup({ delayMs: 400 });

    await request(app)
      .post('/secure-inquiry')
      .set('x-simulate-ai-failure', 'true')
      .send({ userId: 'user-1', message: 'one' });
    await request(app)
      .post('/secure-inquiry')
      .set('x-simulate-ai-failure', 'true')
      .send({ userId: 'user-1', message: 'two' });
    await request(app)
      .post('/secure-inquiry')
      .set('x-simulate-ai-failure', 'true')
      .send({ userId: 'user-1', message: 'three' });

    await waitFor(() => {
      expect(circuitBreaker.snapshot().state).toBe(STATES.OPEN);
    });

    const startedAt = Date.now();
    const fallback = await request(app)
      .post('/secure-inquiry')
      .send({ userId: 'user-1', message: 'should-not-wait' });
    const elapsedMs = Date.now() - startedAt;

    await waitFor(() => {
      expect(fallback.status).toBe(503);
      expect(fallback.body.error).toBe('Service Busy');
      expect(elapsedMs).toBeLessThan(150);
    });
  });

  it('exposes circuit state on /health', async () => {
    const { app } = setup();
    const response = await request(app).get('/health');

    await waitFor(() => {
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.circuit.state).toBe(STATES.CLOSED);
    });
  });
});
