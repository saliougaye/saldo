import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './secret';

const key = Buffer.alloc(32, 'A');
const otherKey = Buffer.alloc(32, 'B');
const SLOT = 'smtp.password';
// Not a real password: the point is only that it must not show up in what is stored.
const PLAIN = 'fake-password-for-tests';

describe('secret cipher', () => {
  it('round-trips, including non-ASCII and the empty string', () => {
    for (const plain of [PLAIN, 'pässwörd-€-🔑', '']) {
      expect(decryptSecret(encryptSecret(plain, key, SLOT), key, SLOT)).toBe(plain);
    }
  });

  it('gives two different envelopes for one value (a fresh IV each time)', () => {
    expect(encryptSecret(PLAIN, key, SLOT)).not.toBe(encryptSecret(PLAIN, key, SLOT));
  });

  it('stores v1:{iv}:{tag}:{ciphertext}, each part base64, with no plaintext in it', () => {
    const stored = encryptSecret(PLAIN, key, SLOT);
    const parts = stored.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');
    expect(Buffer.from(parts[1] ?? '', 'base64')).toHaveLength(12);
    expect(Buffer.from(parts[2] ?? '', 'base64')).toHaveLength(16);
    expect(stored).not.toContain(PLAIN);
    expect(Buffer.from(parts[3] ?? '', 'base64').toString('utf8')).not.toContain(PLAIN);
  });

  it('answers null, never a throw, for a wrong key', () => {
    expect(decryptSecret(encryptSecret(PLAIN, key, SLOT), otherKey, SLOT)).toBeNull();
  });

  it('answers null for a wrong slot: a ciphertext copied to another setting is useless', () => {
    expect(decryptSecret(encryptSecret(PLAIN, key, SLOT), key, 'ai.apiKey')).toBeNull();
  });

  it('answers null for a tampered value', () => {
    const [version, iv, tag, body] = encryptSecret(PLAIN, key, SLOT).split(':');
    const flipped = Buffer.from(body ?? '', 'base64');
    flipped[0] = (flipped[0] ?? 0) ^ 1;
    expect(
      decryptSecret([version, iv, tag, flipped.toString('base64')].join(':'), key, SLOT),
    ).toBeNull();
    const badTag = Buffer.from(randomBytes(16)).toString('base64');
    expect(decryptSecret([version, iv, badTag, body].join(':'), key, SLOT)).toBeNull();
  });

  it('answers null for a malformed value', () => {
    const stored = encryptSecret(PLAIN, key, SLOT);
    for (const bad of [
      '',
      'nonsense',
      'v1:a:b',
      stored.replace('v1', 'v2'),
      `${stored}:extra`,
      'v1:::',
      'v1:!!!:???:***',
    ]) {
      expect(decryptSecret(bad, key, SLOT)).toBeNull();
    }
  });
});
