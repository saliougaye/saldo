import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  type Browser,
  type BrowserContext,
  type Page,
  request as playwrightRequest,
} from '@playwright/test';
import type { Translate } from '@saldo/i18n';
import { E2E_ORIGIN, serverEnv } from '../env';
import { addVirtualAuthenticator, type VirtualAuthenticator } from './authenticator';
import { finishOnboarding } from './onboarding';
import { ADMIN_STORAGE } from './state';

const run = promisify(execFile);

export interface Member {
  id: string;
  name: string;
  email: string;
  context: BrowserContext;
  page: Page;
  authenticator: VirtualAuthenticator;
}

/** An invite code, minted through the API with the admin's session — the way /admin does it. */
export async function mintInvite(label?: string): Promise<string> {
  const api = await playwrightRequest.newContext({
    baseURL: E2E_ORIGIN,
    storageState: ADMIN_STORAGE,
    extraHTTPHeaders: { Origin: E2E_ORIGIN },
  });
  try {
    const response = await api.post('/api/invites', { data: label === undefined ? {} : { label } });
    if (!response.ok()) throw new Error(`invite refused: ${response.status()}`);
    const body = (await response.json()) as { code: string };
    return body.code;
  } finally {
    await api.dispose();
  }
}

/**
 * Fills `apps/web`'s dev seed for an account (`scripts/seed.ts`): three accounts, tags, a few months
 * of transactions, budgets, goals and recurrences, through the server's own write functions.
 */
export async function seedAccount(userId: string): Promise<void> {
  await run('pnpm', ['exec', 'tsx', 'scripts/seed.ts', userId], {
    cwd: `${__dirname}/../..`,
    env: { ...process.env, ...serverEnv },
  });
}

export interface NewMember {
  name: string;
  email: string;
  /** Run the dev seed after onboarding. Default false. */
  seed?: boolean;
  /** Skip onboarding, leaving the account on `/onboarding`. Default false. */
  skipOnboarding?: boolean;
}

/**
 * A new account in its own browser context: invite, registration with a virtual passkey, and the
 * default onboarding. Every test that needs data of its own takes one, so tests never share rows.
 */
export async function createMember(
  browser: Browser,
  t: Translate,
  options: NewMember,
): Promise<Member> {
  const code = await mintInvite(options.name);
  const context = await browser.newContext({ locale: 'it-IT', baseURL: E2E_ORIGIN });
  const page = await context.newPage();
  const authenticator = await addVirtualAuthenticator(page);

  await page.goto('/register');
  await page.getByLabel(t('web.auth.nameLabel')).fill(options.name);
  await page.getByLabel(t('web.auth.emailLabel')).fill(options.email);
  await page.getByRole('button', { name: t('common.continue') }).click();
  await page.getByLabel(t('web.auth.inviteLabel')).fill(code);
  await page.getByRole('button', { name: t('common.continue') }).click();
  await page.getByRole('button', { name: t('web.auth.passkeyButton') }).click();
  await page.waitForURL(/\/(home|onboarding)$/);

  const me = await context.request.get('/api/me');
  const { id } = (await me.json()) as { id: string };

  if (options.skipOnboarding !== true) {
    await page.waitForURL(/\/onboarding$/);
    await finishOnboarding(page, t);
    await page.waitForURL(/\/home$/);
    if (options.seed === true) {
      await seedAccount(id);
      await page.reload();
    }
  }
  return { id, name: options.name, email: options.email, context, page, authenticator };
}
