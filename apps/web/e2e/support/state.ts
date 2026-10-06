import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { E2E_PORT } from '../env';
import type { StoredCredential } from './authenticator';

/** Written by the `setup` project, read by every other spec. One folder per port. Ignored by git. */
const STATE_DIR = join(__dirname, '..', '.state', String(E2E_PORT));

export const ADMIN_STORAGE = join(STATE_DIR, 'admin.json');
const ADMIN_CREDENTIALS = join(STATE_DIR, 'admin-credentials.json');

export const ADMIN = { name: 'Giulia', email: 'giulia@e2e.test', instance: 'Casa E2E' } as const;

export function saveAdminCredentials(credentials: StoredCredential[]): void {
  mkdirSync(dirname(ADMIN_CREDENTIALS), { recursive: true });
  writeFileSync(ADMIN_CREDENTIALS, JSON.stringify(credentials));
}

export function loadAdminCredentials(): StoredCredential[] {
  return JSON.parse(readFileSync(ADMIN_CREDENTIALS, 'utf8')) as StoredCredential[];
}
