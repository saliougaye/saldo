import { test as base } from '@playwright/test';
import { catalogs, makeTranslator, type Translate } from '@saldo/i18n';
import { clientHeaders } from './env';
import { addVirtualAuthenticator, type VirtualAuthenticator } from './support/authenticator';

interface Fixtures {
  /** The catalog of the project's `locale`: the suite reads copy from the app's own keys, never from literals. */
  t: Translate;
  /** A passkey authenticator that approves by itself, attached to `page`. */
  authenticator: VirtualAuthenticator;
}

export const test = base.extend<Fixtures>({
  // A caller address for each test, so the auth rate limit never counts one test against another.
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads the fixtures from the pattern.
  extraHTTPHeaders: async ({}, use) => {
    await use(clientHeaders());
  },
  t: async ({ locale }, use) => {
    const language = (locale ?? 'it').slice(0, 2);
    await use(makeTranslator(catalogs[language as keyof typeof catalogs] ?? catalogs.it));
  },
  authenticator: async ({ page }, use) => {
    const authenticator = await addVirtualAuthenticator(page);
    await use(authenticator);
  },
});

export { expect } from '@playwright/test';
