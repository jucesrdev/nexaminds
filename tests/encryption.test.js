const { createEncryption } = require('../src/services/encryption');
const { createTestEncryptionKey } = require('./helpers/testKey');

const KEY = createTestEncryptionKey();

describe('encryption', () => {
  it('round-trips plaintext with AES-256-GCM', () => {
    const { encrypt, decrypt } = createEncryption(KEY);
    const payload = encrypt('ssn 123-45-6789');

    expect(payload.algorithm).toBe('aes-256-gcm');
    expect(payload.ciphertext).not.toContain('123-45-6789');
    expect(decrypt(payload)).toBe('ssn 123-45-6789');
  });

  it('produces a different ciphertext each time', () => {
    const { encrypt } = createEncryption(KEY);
    expect(encrypt('same').ciphertext).not.toBe(encrypt('same').ciphertext);
  });

  it('rejects a malformed key', () => {
    expect(() => createEncryption('too-short')).toThrow(/64 hex characters/);
  });
});
