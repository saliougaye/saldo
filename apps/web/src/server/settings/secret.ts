import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * §17.1.8. Secrets the admin panel stores (today the SMTP password) are encrypted with
 * AES-256-GCM under `SETTINGS_ENCRYPTION_KEY`, so a database backup alone does not leak them.
 *
 * Stored as `v1:{iv}:{tag}:{ciphertext}`, each part base64. The **slot** (`'smtp.password'`) is the
 * additional authenticated data: a ciphertext copied into another setting does not decrypt.
 */
const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export function encryptSecret(plain: string, key: Buffer, slot: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(slot, 'utf8'));
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), body].map(encodePart).join(':');
}

function encodePart(part: string | Buffer): string {
  return typeof part === 'string' ? part : part.toString('base64');
}

function decodePart(part: string): Buffer | null {
  return BASE64.test(part) ? Buffer.from(part, 'base64') : null;
}

/**
 * `null` — never a throw — for a wrong key, a wrong slot, a tampered or a malformed value: a page
 * must be able to say «this password no longer reads» rather than fail.
 */
export function decryptSecret(stored: string, key: Buffer, slot: string): string | null {
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  const iv = decodePart(parts[1] ?? '');
  const tag = decodePart(parts[2] ?? '');
  const body = decodePart(parts[3] ?? '');
  if (iv === null || tag === null || body === null) return null;
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(slot, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
