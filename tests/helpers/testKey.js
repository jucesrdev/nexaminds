const crypto = require('crypto');

function createTestEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { createTestEncryptionKey };
