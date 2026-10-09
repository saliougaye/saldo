import { join } from 'node:path';
import { E2E_PORT } from '../env';

/** Written by the `setup` project, read by every other spec. One folder per port. Ignored by git. */
const STATE_DIR = join(__dirname, '..', '.state', String(E2E_PORT));

export const ADMIN_STORAGE = join(STATE_DIR, 'admin.json');

export const ADMIN = { name: 'Giulia', email: 'giulia@e2e.test', instance: 'Casa E2E' } as const;
