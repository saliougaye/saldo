import { expect, test } from './fixtures';
import { clearSmtp, configureSmtp, linkIn, startMailSink } from './support/auth';
import { createMember } from './support/members';
import { ageSessions } from './support/sessions';

/** `ada@example.com` → `a***@example.com`, the form the notice to the old address uses. */
function masked(email: string): string {
  const at = email.lastIndexOf('@');
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

/** A literal as a pattern: every character that a regular expression reads is escaped, backslash too. */
function literal(text: string): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

// Plan `docs/superpowers/plans/2026-10-19-change-email.md`. The route tests cover the refusals (same
// address, taken address, expired link, replay, throttle). This flow follows the happy path through
// the real pages and a real SMTP connection.
test('a verified member changes the address: the link in the new mailbox swaps it, the old one gets a notice', async ({
  browser,
  t,
}) => {
  test.slow();
  const sink = await startMailSink();
  try {
    // The server sends no mail until the admin points it at one. The setting is instance-wide, so
    // it lives only for this test (`profile.spec.ts` expects a server without mail).
    await configureSmtp(browser, t, sink.port);
    const oldEmail = 'cambio-vecchia@e2e.test';
    const newEmail = 'cambio-nuova@e2e.test';
    const member = await createMember(browser, t, { name: 'Cambio', email: oldEmail });
    const { page } = member;

    // The notice goes only to a verified address: follow the verification link first.
    await page.goto(linkIn(await sink.waitFor(oldEmail, /verify-email/)));
    await expect(page).toHaveURL(/\/email-verified/);

    await page.goto('/profile/account');
    await expect(page.getByText(t('web.account.verified'), { exact: true })).toBeVisible();
    await page.getByRole('link', { name: t('web.account.changeEmail') }).click();
    await page.getByLabel(t('web.account.changeLabel')).fill(newEmail);
    await page.getByRole('button', { name: t('web.account.changeSend') }).click();
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: t('web.account.changePending', { email: newEmail }) }),
    ).toBeVisible();

    // Until the link is opened, the account keeps its address.
    await page.goto('/profile/account');
    await expect(
      page.getByText(oldEmail, { exact: true }).locator('visible=true').first(),
    ).toBeVisible();

    // The link opens a page that asks; the button spends it.
    const link = linkIn(await sink.waitFor(newEmail, /email-change\?token=/));
    await page.goto(link);
    await expect(page.getByRole('heading', { name: t('web.auth.emailChangeTitle') })).toBeVisible();
    await page.getByRole('button', { name: t('web.auth.emailChangeButton') }).click();
    await expect(
      page.getByRole('heading', { name: t('web.auth.emailChangeDoneTitle') }),
    ).toBeVisible();

    await page.goto('/profile/account');
    await expect(
      page.getByText(newEmail, { exact: true }).locator('visible=true').first(),
    ).toBeVisible();
    await expect(page.getByText(oldEmail, { exact: true })).toHaveCount(0);
    await expect(page.getByText(t('web.account.verified'), { exact: true })).toBeVisible();

    // The old address is told, with the new one masked.
    await sink.waitFor(oldEmail, literal(masked(newEmail)));
    await member.context.close();
  } finally {
    await clearSmtp(browser, t);
    await sink.close();
  }
});

// Spec `docs/superpowers/specs/2026-10-24-email-change-fresh-passkey.html`. The route tests cover the
// rule on its own. This flow covers the button: the old session is refused, the passkey makes a new
// session, and the same address goes out.
test('a session older than five minutes asks for the passkey, then the change goes out', async ({
  browser,
  t,
}) => {
  test.slow();
  const sink = await startMailSink();
  try {
    await configureSmtp(browser, t, sink.port);
    const newEmail = 'passkey-nuova@e2e.test';
    const member = await createMember(browser, t, {
      name: 'Passkey',
      email: 'passkey-vecchia@e2e.test',
    });
    const { page } = member;
    await ageSessions(member.id, 10);

    await page.goto('/profile/account');
    await page.getByRole('link', { name: t('web.account.changeEmail') }).click();
    await page.getByLabel(t('web.account.changeLabel')).fill(newEmail);
    await page.getByRole('button', { name: t('web.account.changeSend') }).click();

    // Nothing is stored yet: the form asks for the passkey and waits for a click.
    await expect(page.getByText(t('web.account.changeReauth'))).toBeVisible();
    await page.getByRole('button', { name: t('web.account.changeReauthButton') }).click();

    await expect(
      page
        .getByRole('status')
        .filter({ hasText: t('web.account.changePending', { email: newEmail }) }),
    ).toBeVisible();
    await sink.waitFor(newEmail, /email-change\?token=/);
    await member.context.close();
  } finally {
    await clearSmtp(browser, t);
    await sink.close();
  }
});
