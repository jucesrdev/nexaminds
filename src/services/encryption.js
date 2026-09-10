const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_HEX_LENGTH = 64;

function parseKey(encryptionKey) {
  if (typeof encryptionKey !== 'string' || !/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
    throw new Error(
      `ENCRYPTION_KEY must be ${KEY_HEX_LENGTH} hex characters (32 bytes)`
    );
  }
  return Buffer.from(encryptionKey, 'hex');
}

function createEncryption(encryptionKey) {
  const key = parseKey(encryptionKey);

  function encrypt(plaintext) {
    if (typeof plaintext !== 'string') {
      throw new TypeError('plaintext must be a string');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      algorithm: ALGORITHM,
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  function decrypt(payload) {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(payload.iv, 'base64'),
      { authTagLength: AUTH_TAG_LENGTH }
    );
    decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'base64')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }

  return { encrypt, decrypt };
}

module.exports = { createEncryption, parseKey };
