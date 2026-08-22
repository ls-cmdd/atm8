import test from 'node:test';
import assert from 'node:assert';
import { CredentialsService } from '../credentials.service.js';

test('CredentialsService - encryption and decryption end-to-end', (t) => {
  const service = new CredentialsService();
  const secret = 'super-secret-key';
  const { encrypted, iv, authTag } = service.encrypt(secret);
  
  assert.notStrictEqual(encrypted, secret, 'Encrypted text should not match plain text');
  
  const decrypted = service.decrypt(encrypted, iv, authTag);
  assert.strictEqual(decrypted, secret, 'Decrypted text must match original secret');
});

test('CredentialsService - masking', (t) => {
  const service = new CredentialsService();
  assert.strictEqual(service.mask('1234567890'), '******7890');
  assert.strictEqual(service.mask('1234'), '****');
});
