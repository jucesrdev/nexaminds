const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

function createAuditLog({ filePath }) {
  let writeChain = Promise.resolve();

  async function readEntries() {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async function persist(entries) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
    await fs.rename(tempPath, filePath);
  }

  function append(entry) {
    const record = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    };

    writeChain = writeChain.then(async () => {
      const entries = await readEntries();
      entries.push(record);
      await persist(entries);
      return record;
    });

    return writeChain;
  }

  return { append, readEntries };
}

module.exports = { createAuditLog };
