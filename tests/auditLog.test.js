const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { createAuditLog } = require('../src/services/auditLog');
const { waitFor } = require('./helpers/waitFor');

describe('auditLog', () => {
  let filePath;
  let auditLog;

  beforeEach(async () => {
    filePath = path.join(os.tmpdir(), `audit-${Date.now()}-${Math.random()}.json`);
    auditLog = createAuditLog({ filePath });
  });

  afterEach(async () => {
    await fs.rm(filePath, { force: true });
  });

  it('appends records to a JSON file', async () => {
    await auditLog.append({ userId: 'u1', redactedMessage: 'hello' });

    await waitFor(async () => {
      const entries = await auditLog.readEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].userId).toBe('u1');
      expect(entries[0].redactedMessage).toBe('hello');
      expect(entries[0].id).toEqual(expect.any(String));
      expect(entries[0].timestamp).toEqual(expect.any(String));
    });
  });

  it('serializes concurrent writes without dropping entries', async () => {
    await Promise.all([
      auditLog.append({ userId: 'a' }),
      auditLog.append({ userId: 'b' }),
      auditLog.append({ userId: 'c' }),
    ]);

    await waitFor(async () => {
      const entries = await auditLog.readEntries();
      expect(entries).toHaveLength(3);
      expect(entries.map((entry) => entry.userId).sort()).toEqual(['a', 'b', 'c']);
    });
  });
});
