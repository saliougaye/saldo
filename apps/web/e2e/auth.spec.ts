import { clientHeaders } from './env';
import { expect, test } from './fixtures';
import {
  alertWith,
  clearSmtp,
  configureSmtp,
  fillIdentity,
  fillInvite,
  linkIn,
  signOut,
  startMailSink,
  withAnotherDevice,
} from './support/auth';
import { addVirtualAuthenticator } from './support/authenticator';
import { createMember, mintInvite } from './support/members';

test.describe('register with an invite', () => {
  test('a wrong code is refused on the invite step and the person can retry', async ({
    page,
    t,
    authenticator,
  }) => {
    await page.goto('/register');
    await fillIdentity(page, t, { name: 'Marta', email: 'marta@e2e.test' });
    await expect(page.getByRole('heading', { name: t('web.auth.inviteTitle') })).toBeVisible();

    await fillInvite(page, t, 'AAAA-BBBB-CCCC-DDDD');
    await expect(alertWith(page, t('web.auth.invalidInviteTitle'))).toBeVisible();
    // Still on the invite step, with nothing spent: no passkey was asked for.
    await expect(page.getByRole('heading', { name: t('web.auth.inviteTitle') })).toBeVisible();
    expect(await authenticator.credentials()).toHaveLength(0);

    await fillInvite(page, t, await mintInvite('Marta'));
    await expect(page.getByRole('heading', { name: t('web.auth.passkeyTitle') })).toBeVisible();
    await page.getByRole('button', { name: t('web.auth.passkeyButton') }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    expect(await authenticator.credentials()).toHaveLength(1);
  });

  test('an invite works once: a used code is refused', async ({ browser, page, t }) => {
    const code = await mintInvite('Una volta');

    const first = await browser.newContext({ locale: 'it-IT', extraHTTPHeaders: clientHeaders() });
    const firstPage = await first.newPage();
    await addVirtualAuthenticator(firstPage);
    await firstPage.goto('/register');
    await fillIdentity(firstPage, t, { name: 'Prima', email: 'prima@e2e.test' });
    await fillInvite(firstPage, t, code);
    await firstPage.getByRole('button', { name: t('web.auth.passkeyButton') }).click();
    await expect(firstPage).toHaveURL(/\/onboarding$/);
    await first.close();

    await page.goto('/register');
    await fillIdentity(page, t, { name: 'Seconda', email: 'seconda@e2e.test' });
    await fillInvite(page, t, code);
    await expect(alertWith(page, t('web.auth.invalidInviteTitle'))).toBeVisible();
    await expect(page.getByRole('heading', { name: t('web.auth.inviteTitle') })).toBeVisible();
  });

  test('an email already in use is refused on the identity step', async ({
    browser,
    page,
    t,
    authenticator,
  }) => {
    const member = await createMember(browser, t, { name: 'Elena', email: 'elena.auth@e2e.test' });
    await member.context.close();

    await page.goto('/register');
    await fillIdentity(page, t, { name: 'Elena bis', email: 'elena.auth@e2e.test' });
    await fillInvite(page, t, await mintInvite('Elena bis'));
    await page.getByRole('button', { name: t('web.auth.passkeyButton') }).click();

    // The refusal comes back to the step that owns the email, with the field marked.
    await expect(alertWith(page, t('web.auth.emailTakenTitle'))).toBeVisible();
    await expect(page.getByRole('heading', { name: t('web.auth.registerTitle') })).toBeVisible();
    await expect(page.getByLabel(t('web.auth.emailLabel'))).toHaveAttribute('aria-invalid', 'true');
    expect(await authenticator.credentials()).toHaveLength(0);
  });

  test('the identity step refuses an empty name and an invalid email', async ({ page, t }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: t('common.continue') }).click();
    await expect(alertWith(page, t('web.auth.nameRequiredTitle'))).toBeVisible();

    await page.getByLabel(t('web.auth.nameLabel')).fill('Nome');
    await page.getByLabel(t('web.auth.emailLabel')).fill('senza-chiocciola');
    await page.getByRole('button', { name: t('common.continue') }).click();
    // `type="email"`: the browser's own validation stops the form before the page's check runs.
    await expect(page.getByLabel(t('web.auth.emailLabel'))).toHaveJSProperty(
      'validity.valid',
      false,
    );
    await expect(page.getByRole('heading', { name: t('web.auth.registerTitle') })).toBeVisible();
    await expect(page.getByRole('heading', { name: t('web.auth.inviteTitle') })).toHaveCount(0);
  });
});

test.describe('passkey sign-in', () => {
  test('the stored credential signs in from the login page and lands on /home', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, { name: 'Chiara', email: 'chiara@e2e.test' });
    const { page } = member;

    // Signing out sends the browser to /login. The page arms the passkey autofill as it loads, and a
    // virtual authenticator that holds the credential answers it at once.
    await signOut(page, t);
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('navigation', { name: t('web.shell.mainNav') })).toBeVisible();
    await member.context.close();
  });

  test('a signed-out browser is sent to the login page', async ({ browser, t }) => {
    const member = await createMember(browser, t, { name: 'Dario', email: 'dario@e2e.test' });
    const { page, authenticator } = member;

    // With the authenticator refusing, nothing answers the passkey autofill: the page stays on /login.
    await authenticator.setUserVerified(false);
    await signOut(page, t);
    await page.goto('/home');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: t('web.auth.signInTitle') })).toBeVisible();
    await member.context.close();
  });

  test('a refused ceremony shows an alert, and the person can retry', async ({ browser, t }) => {
    const member = await createMember(browser, t, { name: 'Dario', email: 'dario2@e2e.test' });
    const { page, authenticator } = member;
    await authenticator.setUserVerified(false);
    await signOut(page, t);
    const signIn = page.getByRole('button', { name: t('sync.signIn') });

    // The authenticator answers without verifying the person: the server turns the assertion down.
    await signIn.click();
    await expect(alertWith(page, t('web.auth.genericError'))).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);

    await authenticator.setUserVerified(true);
    await signIn.click();
    await expect(page).toHaveURL(/\/home$/);
    await member.context.close();
  });

  // BUG: closing the browser's passkey prompt rejects with `NotAllowedError`. `@simplewebauthn/browser`
  // wraps it as `WebAuthnError` with code `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`, and Better Auth's
  // client passes that code on. `describeAuthError`'s CANCELLED set holds `NotAllowedError` itself
  // and not that code, so the person sees the generic alert and never `sync.cancelled`.
  test.fixme('a cancelled ceremony shows the cancelled alert', async ({ browser, t }) => {
    const member = await createMember(browser, t, { name: 'Dario', email: 'dario3@e2e.test' });
    const { page, authenticator } = member;
    await authenticator.setUserVerified(false);
    await signOut(page, t);

    // What «Annulla» on the browser's own prompt does, once.
    await page.evaluate(() => {
      const credentials = navigator.credentials;
      const original = credentials.get.bind(credentials);
      let cancelled = false;
      credentials.get = (options) => {
        if (cancelled || options?.mediation === 'conditional') return original(options);
        cancelled = true;
        return Promise.reject(new DOMException('The prompt was closed.', 'NotAllowedError'));
      };
    });
    await page.getByRole('button', { name: t('sync.signIn') }).click();
    await expect(alertWith(page, t('sync.cancelled'))).toBeVisible();
    await member.context.close();
  });
});

test.describe('passkeys in Profile', () => {
  test('add a second passkey, delete one, and the last one cannot be deleted', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, { name: 'Irene', email: 'irene@e2e.test' });
    const { page, authenticator } = member;
    const rows = page.locator('a[href^="/profile/passkeys?k="]');

    await page.goto('/profile/passkeys');
    await expect(rows).toHaveCount(1);

    // The only passkey: the panel says why it stays.
    await rows.first().click();
    await expect(page.getByRole('button', { name: t('common.delete') })).toBeDisabled();
    await expect(page.getByText(t('web.passkeys.lastOneNote'))).toBeVisible();

    const { second, restore } = await withAnotherDevice(page, authenticator);
    await page.getByRole('button', { name: t('web.passkeys.add') }).click();
    await expect(rows).toHaveCount(2);
    expect(await second.credentials()).toHaveLength(1);
    await restore();

    await rows.first().click();
    await page.getByRole('button', { name: t('common.delete') }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(t('web.passkeys.deleteTitle'));
    await dialog.getByRole('button', { name: t('common.delete') }).click();
    await expect(rows).toHaveCount(1);

    await rows.first().click();
    await expect(page.getByRole('button', { name: t('common.delete') })).toBeDisabled();
    await member.context.close();
  });
});

test.describe('recovery', () => {
  test('a server that sends no mail says that recovery is unavailable', async ({ page, t }) => {
    await page.goto('/login');
    // The link to /recover shows only where mail works.
    await expect(page.getByRole('link', { name: t('web.auth.recoverLink') })).toHaveCount(0);

    await page.goto('/recover');
    await expect(alertWith(page, t('web.auth.recoverOffTitle'))).toBeVisible();
    await page.getByRole('link', { name: t('web.auth.backToSignIn') }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('a lost passkey: the link in the mail signs in once and asks for a new passkey', async ({
    browser,
    t,
  }) => {
    test.slow();
    const sink = await startMailSink();
    try {
      await configureSmtp(browser, t, sink.port);
      const email = 'lia@e2e.test';
      const member = await createMember(browser, t, { name: 'Lia', email });
      const { page, authenticator } = member;

      // Recovery mails only a verified address: follow the link of the verification mail first.
      const verification = await sink.waitFor(email, /verify-email/);
      await page.goto(linkIn(verification));
      await expect(page).toHaveURL(/\/email-verified/);

      // The passkey is gone with the device.
      await authenticator.remove();
      await signOut(page, t);
      await page.getByRole('link', { name: t('web.auth.recoverLink') }).click();
      await expect(page.getByRole('heading', { name: t('web.auth.recoverTitle') })).toBeVisible();
      await page.getByLabel(t('web.auth.emailLabel')).fill(email);
      await page.getByRole('button', { name: t('web.auth.recoverSubmit') }).click();
      await expect(alertWith(page, t('web.auth.recoverSent'))).toBeVisible();

      const recovery = await sink.waitFor(email, /recover\/confirm/);
      const link = linkIn(recovery);
      // Opening the link spends nothing: a person presses the button.
      await page.goto(link);
      await expect(
        page.getByRole('heading', { name: t('web.auth.recoverConfirmTitle') }),
      ).toBeVisible();
      await page.getByRole('button', { name: t('web.auth.recoverConfirmButton') }).click();
      await expect(page).toHaveURL(/\/profile\/passkeys\?recovered/);
      await expect(alertWith(page, t('web.passkeys.recoveredTitle', { email }))).toBeVisible();

      // The link is spent: the same address sends the person back to ask for a new one.
      await signOut(page, t);
      await page.goto(link);
      await page.getByRole('button', { name: t('web.auth.recoverConfirmButton') }).click();
      await expect(page).toHaveURL(/\/recover\?error=/);
      await expect(alertWith(page, t('web.auth.recoverExpiredTitle'))).toBeVisible();
      await member.context.close();
    } finally {
      await clearSmtp(browser, t);
      await sink.close();
    }
  });
});
