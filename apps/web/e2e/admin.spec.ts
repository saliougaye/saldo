import type { Page } from '@playwright/test';
import { clientHeaders, E2E_ORIGIN } from './env';
import { expect, test } from './fixtures';
import {
  type AuthorizationRequest,
  captureCallback,
  openAdmin,
  startAuthorization,
} from './support/admin';
import { createMember, type Member, mintInvite } from './support/members';
import { ADMIN } from './support/state';
import { literal } from './support/txPage';

/** Matches a name that starts with `text`, taken literally: «Email (SMTP)» has parentheses. */
function startsWith(text: string): RegExp {
  return new RegExp(`^${literal(text).source}`);
}

/**
 * What the browser of `page` gets for `href`: the document, or the RSC payload that a click asks for.
 * From the page, so that the request carries the browser's language as a real one does.
 */
async function fetchIn(
  page: Page,
  href: string,
  rsc: boolean,
): Promise<{ status: number; body: string }> {
  return page.evaluate(
    async (input) => {
      const response = await fetch(input.href, { headers: input.rsc ? { RSC: '1' } : {} });
      return { status: response.status, body: await response.text() };
    },
    { href, rsc },
  );
}

/** An account's row in Admin → Account: its link names the name, the address and the role. */
function accountRow(page: Page, name: string) {
  return page.getByRole('link', { name: new RegExp(name) });
}

/** The panel an account's row opens: a landmark named after the person. */
function accountPanel(page: Page, name: string) {
  return page.getByRole('dialog', { name });
}

test.describe('accounts', () => {
  test('the list shows the roles, and a row opens the facts of that account', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Elena Elenco',
      email: 'elena@e2e.test',
    });
    const admin = await openAdmin(browser);
    const { page } = admin;
    await page.goto('/admin/accounts');

    await expect(page.getByRole('heading', { name: t('admin.title') })).toBeVisible();
    await expect(accountRow(page, ADMIN.name)).toContainText(t('admin.roleAdmin'));
    await expect(accountRow(page, member.name)).toContainText(member.email);
    await expect(accountRow(page, member.name)).toContainText(t('admin.roleMember'));

    await accountRow(page, member.name).click();
    const panel = accountPanel(page, member.name);
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(t('admin.accounts.statusActive'));
    await expect(panel).toContainText(member.email);
    // The member registered with an invite the admin minted, labelled with the member's name.
    await expect(panel).toContainText(
      t('admin.accounts.createdWithInvite', { date: '', invite: member.name }).replace(
        /^[,\s]+/,
        '',
      ),
    );
    await expect(panel.getByRole('button', { name: t('admin.accounts.revoke') })).toBeVisible();
    await expect(panel.getByRole('button', { name: t('admin.accounts.delete') })).toBeVisible();

    await panel.getByRole('link', { name: t('common.close') }).click();
    await expect(page).toHaveURL(/\/admin\/accounts$/);
    await expect(panel).toHaveCount(0);
    await member.context.close();
    await admin.context.close();
  });

  test('an admin cannot revoke or delete their own account', async ({ browser, t }) => {
    const admin = await openAdmin(browser);
    const { page } = admin;
    await page.goto('/admin/accounts');
    await accountRow(page, ADMIN.name).click();
    const panel = accountPanel(page, ADMIN.name);
    await expect(panel.getByText(t('admin.accounts.selfNote'))).toBeVisible();
    await expect(panel.getByRole('button', { name: t('admin.accounts.revoke') })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: t('admin.accounts.delete') })).toHaveCount(0);
    await admin.context.close();
  });

  test('revoking signs the member out at once, and restoring lets the passkey in again', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, { name: 'Rita Revoca', email: 'rita@e2e.test' });
    await member.page.goto('/home');
    await expect(member.page).toHaveURL(/\/home$/);

    const admin = await openAdmin(browser);
    const { page } = admin;
    await page.goto('/admin/accounts');
    await accountRow(page, member.name).click();
    const panel = accountPanel(page, member.name);

    // Revoking asks first; cancelling changes nothing.
    await panel.getByRole('button', { name: t('admin.accounts.revoke') }).click();
    const dialog = page.getByRole('alertdialog', {
      name: t('admin.accounts.revokeTitle', { name: member.name }),
    });
    await dialog.getByRole('button', { name: t('common.cancel') }).click();
    await expect(dialog).toHaveCount(0);
    await expect(panel).toContainText(t('admin.accounts.statusActive'));

    await panel.getByRole('button', { name: t('admin.accounts.revoke') }).click();
    await dialog
      .getByRole('button', { name: t('admin.accounts.revokeConfirm'), exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(panel).toContainText(t('admin.accounts.statusRevoked'));
    await expect(accountRow(page, member.name)).toContainText(t('admin.accounts.revoked'));
    await expect(panel.getByRole('button', { name: t('admin.accounts.restore') })).toBeVisible();

    // The member's session is gone: the next page is the sign-in page, and the API says so.
    await member.page.goto('/home');
    await expect(member.page).toHaveURL(/\/login/);
    expect((await member.context.request.get('/api/me')).status()).toBe(401);

    // The passkey does not get a revoked account back in.
    await member.page.getByRole('button', { name: t('sync.signIn') }).click();
    await expect(member.page.getByRole('alert')).toBeVisible();
    await expect(member.page).toHaveURL(/\/login/);

    await panel.getByRole('button', { name: t('admin.accounts.restore') }).click();
    await expect(panel).toContainText(t('admin.accounts.statusActive'));
    await expect(accountRow(page, member.name)).not.toContainText(t('admin.accounts.revoked'));

    // The login page arms the passkey autofill as it loads, and the authenticator answers at once.
    await member.page.reload();
    await expect(member.page).toHaveURL(/\/home$/);
    expect((await member.context.request.get('/api/me')).status()).toBe(200);

    await member.context.close();
    await admin.context.close();
  });

  test('deleting an account waits for the typed address and removes the row', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Dario Delete',
      email: 'dario.admin@e2e.test',
    });
    const admin = await openAdmin(browser);
    const { page } = admin;
    await page.goto('/admin/accounts');
    await accountRow(page, member.name).click();
    await accountPanel(page, member.name)
      .getByRole('button', { name: t('admin.accounts.delete') })
      .click();

    const dialog = page.getByRole('alertdialog', {
      name: t('admin.accounts.deleteTitle', { name: member.name }),
    });
    const confirm = dialog.getByRole('button', { name: t('admin.accounts.deleteConfirm') });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(t('admin.accounts.deleteTypeEmail')).fill('altra@e2e.test');
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(t('admin.accounts.deleteTypeEmail')).fill(member.email);
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page).toHaveURL(/\/admin\/accounts$/);
    await expect(accountRow(page, member.name)).toHaveCount(0);
    await member.context.close();
    await admin.context.close();
  });

  // SECURITY GUARD: the page renders the panel of every account in one response. A member who asks
  // for it, as a page or as the RSC payload of a click, gets the not-found page and none of the facts.
  test('SECURITY GUARD: a member who asks for an account panel gets 404 and none of its facts', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, { name: 'Mia Curiosa', email: 'mia@e2e.test' });
    const admin = await openAdmin(browser);
    await admin.page.goto('/admin/accounts');
    const href = (await accountRow(admin.page, ADMIN.name).getAttribute('href')) ?? '';
    expect(href).toMatch(/\?u=/);
    // The control: the same request from the admin carries what the member must not get.
    const own = await fetchIn(admin.page, href, true);
    expect(own.body).toContain(ADMIN.email);
    expect(own.body).toContain(t('admin.accounts.lastSignIn'));
    await admin.context.close();

    for (const rsc of [false, true]) {
      const { status, body } = await fetchIn(member.page, href, rsc);
      // Next answers the RSC request of a `notFound()` with 200 and the not-found tree in the body.
      if (rsc) expect(body).toContain('NEXT_HTTP_ERROR_FALLBACK;404');
      else expect(status).toBe(404);
      expect(body).not.toContain(ADMIN.email);
      expect(body).not.toContain(t('admin.accounts.lastSignIn'));
      expect(body).not.toContain(t('admin.accounts.dangerZone'));
    }
    await member.context.close();
  });
});

test.describe('invites', () => {
  test('an invite is minted, listed, and refused for registration once revoked', async ({
    browser,
    t,
  }) => {
    const label = 'Zio Invitato';
    const admin = await openAdmin(browser);
    const { page } = admin;
    await page.goto('/admin/invites');
    await page
      .getByRole('link', { name: t('admin.invites.new') })
      .first()
      .click();

    const form = page.getByRole('dialog', { name: t('admin.invites.new') });
    await form.getByLabel(t('admin.invites.label')).fill(label);
    await form.getByRole('button', { name: t('admin.invites.create') }).click();

    // The code shows once, here and nowhere else.
    await expect(form.getByText(t('admin.invites.copyNow'))).toBeVisible();
    const code =
      (await form
        .locator('p', { hasText: /^[A-Z0-9-]{16,}$/ })
        .first()
        .textContent()) ?? '';
    expect(code).not.toBe('');
    await expect(form.getByRole('img', { name: t('admin.invites.qrLabel') })).toBeVisible();
    await form.getByRole('button', { name: t('admin.invites.done') }).click();

    const row = page.getByRole('link', { name: new RegExp(label) });
    await expect(row).toContainText(t('admin.invites.statusActive'));
    await expect(page.getByText(code)).toHaveCount(0);

    await row.click();
    const panel = page.getByRole('dialog', { name: label });
    await expect(panel).toContainText(t('admin.invites.codeGone'));
    await panel.getByRole('button', { name: t('admin.invites.revoke') }).click();
    const dialog = page.getByRole('alertdialog', {
      name: t('admin.invites.revokeTitle', { label }),
    });
    await dialog.getByRole('button', { name: t('admin.invites.revoke'), exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row).toContainText(t('admin.invites.statusRevoked'));
    await expect(panel.getByRole('button', { name: t('admin.invites.revoke') })).toHaveCount(0);

    // A revoked code is refused on the invite step of the registration.
    const visitor = await browser.newContext({
      locale: 'it-IT',
      baseURL: E2E_ORIGIN,
      extraHTTPHeaders: clientHeaders(),
    });
    const register = await visitor.newPage();
    await register.goto('/register');
    await register.getByLabel(t('web.auth.nameLabel')).fill('Zio');
    await register.getByLabel(t('web.auth.emailLabel')).fill('zio@e2e.test');
    await register.getByRole('button', { name: t('common.continue') }).click();
    await register.getByLabel(t('web.auth.inviteLabel')).fill(code);
    await register.getByRole('button', { name: t('common.continue') }).click();
    // The invite step turns it down: the passkey step is never reached.
    await expect(
      register.getByRole('alert').filter({ hasText: t('web.auth.invalidInviteTitle') }),
    ).toBeVisible();

    await visitor.close();
    await admin.context.close();
  });

  test('a minted invite lets a person register, and the list then says who used it', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, { name: 'Ugo Usato', email: 'ugo@e2e.test' });
    const admin = await openAdmin(browser);
    const { page } = admin;
    await page.goto('/admin/invites');
    // `createMember` labels its invite with the member's name.
    const row = page.getByRole('link', { name: new RegExp(member.name) });
    await expect(row).toContainText(t('admin.invites.statusUsed'));
    await expect(row).toContainText(member.email);
    await row.click();
    const panel = page.getByRole('dialog', { name: member.name });
    await expect(panel).toContainText(member.email);
    await expect(panel.getByRole('button', { name: t('admin.invites.revoke') })).toHaveCount(0);

    // An invite nobody used shows as active and carries no «used by».
    const label = 'Invito aperto';
    await mintInvite(label);
    await page.goto('/admin/invites');
    await expect(page.getByRole('link', { name: new RegExp(label) })).toContainText(
      t('admin.invites.statusActive'),
    );
    await member.context.close();
    await admin.context.close();
  });

  test('a label longer than the limit cannot be typed', async ({ browser, t }) => {
    const admin = await openAdmin(browser);
    const { page } = admin;
    await page.goto('/admin/invites?new');
    const field = page
      .getByRole('dialog', { name: t('admin.invites.new') })
      .getByLabel(t('admin.invites.label'));
    await field.fill('x'.repeat(200));
    const length = (await field.inputValue()).length;
    expect(length).toBeLessThan(200);
    await admin.context.close();
  });

  // SECURITY GUARD: an invite code is a bearer secret. The page renders the panel of every invite
  // in one response, so no response of the page may hold a code: not the list, not a panel, not
  // the refresh after a mint.
  test('SECURITY GUARD: no response of the invites page holds an invite code', async ({
    browser,
    t,
  }) => {
    const label = 'Codice Segreto';
    const fromApi = await mintInvite('Invito Api');
    const admin = await openAdmin(browser);
    const { page } = admin;
    await page.goto('/admin/invites');
    await page
      .getByRole('link', { name: t('admin.invites.new') })
      .first()
      .click();
    const form = page.getByRole('dialog', { name: t('admin.invites.new') });
    await form.getByLabel(t('admin.invites.label')).fill(label);
    await form.getByRole('button', { name: t('admin.invites.create') }).click();
    await expect(form.getByText(t('admin.invites.copyNow'))).toBeVisible();
    const minted =
      (await form
        .locator('p', { hasText: /^[A-Z0-9-]{16,}$/ })
        .first()
        .textContent()) ?? '';
    expect(minted).not.toBe('');

    // ✕ closes in place, and the list behind it already has the new invite.
    await form.getByRole('link', { name: t('common.close') }).click();
    await expect(form).toHaveCount(0);
    const row = page.getByRole('link', { name: new RegExp(label) });
    await expect(row).toContainText(t('admin.invites.statusActive'));

    const href = (await row.getAttribute('href')) ?? '';
    for (const url of ['/admin/invites', href, '/admin/invites?new']) {
      for (const rsc of [false, true]) {
        const { body } = await fetchIn(page, url, rsc);
        // The control: the response is the page, with the invite in it.
        expect(body).toContain(label);
        for (const code of [minted, fromApi]) {
          expect(body).not.toContain(code);
          expect(body).not.toContain(code.replaceAll('-', ''));
        }
      }
    }
    await admin.context.close();
  });
});

test.describe('instance and settings', () => {
  test('Istanza shows the build and what the environment sets', async ({ browser, t }) => {
    const admin = await openAdmin(browser);
    const { page } = admin;
    await page.goto('/admin/instance');
    await expect(page.getByRole('heading', { name: t('admin.nav.instance') })).toBeVisible();
    await expect(page.getByText(t('admin.instance.storageNone'))).toBeVisible();
    await expect(page.getByText('ATTACHMENT_STORAGE=none')).toBeVisible();
    await expect(page.getByText(E2E_ORIGIN, { exact: true })).toBeVisible();
    await admin.context.close();
  });

  test('the settings rows open their panels, unlocked on this instance', async ({ browser, t }) => {
    const admin = await openAdmin(browser);
    const { page } = admin;
    await page.goto('/admin/settings');
    await expect(page.getByRole('link', { name: new RegExp(ADMIN.instance) })).toBeVisible();

    await page.getByRole('link', { name: startsWith(t('admin.settings.name.title')) }).click();
    const name = page.getByRole('dialog', { name: t('admin.settings.name.title') });
    await expect(name.getByLabel(t('admin.settings.name.field'))).toHaveValue(ADMIN.instance);
    await expect(name.getByText(t('admin.settings.locked.title'))).toHaveCount(0);
    // D3: a dialog covers the rows, so each panel is closed before the next row.
    await name.getByRole('link', { name: t('common.close') }).click();
    await expect(name).toHaveCount(0);

    await page
      .getByRole('link', { name: startsWith(t('admin.settings.registration.title')) })
      .click();
    const registration = page.getByRole('dialog', {
      name: t('admin.settings.registration.title'),
    });
    await expect(registration.getByRole('radio', { name: /./ })).toHaveCount(4);
    await expect(registration.getByText(t('admin.settings.locked.title'))).toHaveCount(0);
    await registration.getByRole('link', { name: t('common.close') }).click();
    await expect(registration).toHaveCount(0);

    await page.getByRole('link', { name: startsWith(t('admin.settings.smtp.title')) }).click();
    const smtp = page.getByRole('dialog', { name: t('admin.settings.smtp.title') });
    await expect(smtp.getByLabel(t('admin.settings.smtp.host'))).toBeVisible();
    await admin.context.close();
  });

  test('the instance name is saved, shown in the head, and restored', async ({ browser, t }) => {
    const renamed = 'Casa Rinominata';
    const admin = await openAdmin(browser);
    const { page } = admin;
    const rename = async (value: string) => {
      await page.goto('/admin/settings?edit=name');
      const panel = page.getByRole('dialog', { name: t('admin.settings.name.title') });
      await panel.getByLabel(t('admin.settings.name.field')).fill(value);
      await panel.getByRole('button', { name: t('common.save') }).click();
      await expect(page).toHaveURL(/\/admin\/settings$/);
    };
    try {
      await rename(renamed);
      await expect(page.getByRole('link', { name: new RegExp(renamed) })).toBeVisible();
      await expect(page.getByText(new RegExp(`^${renamed} ·`))).toBeVisible();
      await page.reload();
      await expect(page.getByText(new RegExp(`^${renamed} ·`))).toBeVisible();
    } finally {
      await rename(ADMIN.instance);
    }
    await expect(page.getByText(new RegExp(`^${ADMIN.instance} ·`))).toBeVisible();
    await admin.context.close();
  });

  test('the registration mode is saved only on «Salva», and restored', async ({ browser, t }) => {
    const admin = await openAdmin(browser);
    const { page } = admin;
    const choose = async (label: string, save: boolean) => {
      await page.goto('/admin/settings?edit=registration');
      const panel = page.getByRole('dialog', {
        name: t('admin.settings.registration.title'),
      });
      await panel.getByRole('radio', { name: startsWith(label) }).click();
      if (save) {
        await panel.getByRole('button', { name: t('common.save') }).click();
        await expect(page).toHaveURL(/\/admin\/settings$/);
      }
    };
    const row = () =>
      page.getByRole('link', { name: startsWith(t('admin.settings.registration.title')) });
    await page.goto('/admin/settings');
    const before = await row().textContent();

    try {
      // Choosing without saving changes nothing.
      await choose(t('admin.settings.registration.closed'), false);
      await page.goto('/admin/settings');
      await expect(row()).toHaveText(before ?? '');

      await choose(t('admin.settings.registration.closed'), true);
      await expect(row()).toContainText(t('admin.settings.registration.closed'));
    } finally {
      // The setup wizard leaves the instance on «Solo con invito»: put it back, or later specs cannot join.
      await choose(t('admin.settings.registration.invite'), true);
    }
    await expect(row()).toHaveText(before ?? '');
    await admin.context.close();
  });

  // SECURITY GUARD: the page renders the SMTP panel on every load, open or not. The stored password
  // must not reach any response of the page: the panel learns only that there is one.
  test('SECURITY GUARD: no response of the settings page holds the SMTP password', async ({
    browser,
    t,
  }) => {
    const host = 'smtp.e2e.test';
    const password = 'Pw-Segreta-e2e-4821';
    const admin = await openAdmin(browser);
    const { page } = admin;
    const smtpRow = () =>
      page.getByRole('link', { name: startsWith(t('admin.settings.smtp.title')) });
    const panel = page.getByRole('dialog', { name: t('admin.settings.smtp.title') });
    try {
      await page.goto('/admin/settings');
      await smtpRow().click();
      await panel.getByLabel(t('admin.settings.smtp.host')).fill(host);
      await panel.getByLabel(t('admin.settings.smtp.port')).fill('2525');
      await panel.getByLabel(t('admin.settings.smtp.user')).fill('postino');
      await panel.getByLabel(t('admin.settings.smtp.password'), { exact: true }).fill(password);
      await panel.getByLabel(t('admin.settings.smtp.from')).fill('saldo@e2e.test');
      await panel.getByRole('button', { name: t('common.save'), exact: true }).click();
      await expect(panel.getByText(t('admin.settings.saved'))).toBeVisible();
      await expect(panel.getByText(t('admin.settings.smtp.passwordSet'))).toBeVisible();

      for (const url of ['/admin/settings', '/admin/settings?edit=smtp']) {
        for (const rsc of [false, true]) {
          const { body } = await fetchIn(page, url, rsc);
          // The control: the response is the page, with the saved mail settings in it.
          expect(body).toContain(host);
          expect(body).not.toContain(password);
        }
      }
    } finally {
      await page.goto('/admin/settings?edit=smtp');
      const remove = panel.getByRole('button', { name: t('admin.settings.smtp.remove') });
      // Nothing to remove when the save itself failed: the error of the test is the one to read.
      if ((await remove.count()) > 0) {
        await remove.click();
        await page
          .getByRole('alertdialog')
          .getByRole('button', { name: t('admin.settings.smtp.removeConfirm') })
          .click();
        await expect(smtpRow()).toContainText(t('admin.settings.smtp.notConfigured'));
      }
    }
    await admin.context.close();
  });

  // A setting the environment sets: its panel names the variable and offers no «Salva».
  // The harness sets no variable that locks one of the three settings (it sets
  // ATTACHMENT_STORAGE and APP_REDIRECT_SCHEMES, which show on Istanza only). Needs a variable in
  // `serverEnv` (e.g. `REGISTRATION: 'invite'`) — see the final report.
  test.fixme('a setting locked by the environment shows as locked and cannot be saved', async () => {});
});

test.describe('MCP and OAuth', () => {
  /** A member goes through the authorize URL a client opens, and lands on the consent page. */
  async function openConsent(member: Member, request: AuthorizationRequest) {
    await member.page.goto(request.authorizeUrl);
    await expect(member.page).toHaveURL(/\/oauth\/consent\?/);
  }

  test('the connectors page of the admin shows the switch and what to give a client', async ({
    browser,
    t,
  }) => {
    const admin = await openAdmin(browser);
    const { page } = admin;
    await page.goto('/admin/mcp');
    await expect(page.getByRole('switch', { name: t('admin.mcp.switchLabel') })).toBeChecked();
    await expect(page.getByText(`${E2E_ORIGIN}/mcp`, { exact: true })).toBeVisible();
    await expect(page.getByText('/.well-known/oauth-protected-resource')).toBeVisible();
    // The test server runs on a loopback address: no warning about plain http.
    await expect(page.getByText(t('admin.mcp.httpTitle'))).toHaveCount(0);
    await admin.context.close();
  });

  test('a client is authorized on the consent page, listed in Profile, and revoked there', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Carla Client',
      email: 'carla@e2e.test',
    });
    const clientName = 'Claude Code (e2e)';
    const request = await startAuthorization(clientName);
    const callback = await captureCallback(member.page);
    await openConsent(member, request);

    const { page } = member;
    await expect(page.getByRole('heading', { name: t('web.consent.title') })).toBeVisible();
    await expect(page.getByText(clientName, { exact: true })).toBeVisible();
    await expect(page.getByText(t('web.consent.freshTitle'))).toBeVisible();
    await expect(page.getByText(t('web.consent.signedInAs', { who: member.email }))).toBeVisible();
    await expect(page.getByText(t('web.consent.readTitle'))).toBeVisible();
    // «Leggere» is required and cannot be unticked.
    await expect(
      page.getByRole('checkbox', { name: new RegExp(t('web.consent.readTitle')) }),
    ).toBeDisabled();

    const write = page.getByRole('checkbox', { name: new RegExp(t('web.consent.writeTitle')) });
    await expect(write).toBeChecked();
    await expect(page.getByRole('button', { name: t('web.consent.authorize') })).toBeVisible();
    await write.uncheck();
    await expect(
      page.getByRole('button', { name: t('web.consent.authorizeReadOnly') }),
    ).toBeVisible();
    await page.getByRole('button', { name: t('web.consent.authorizeReadOnly') }).click();

    const arrived = await callback();
    expect(`${arrived.origin}${arrived.pathname}`).toBe('http://127.0.0.1:33418/callback');
    expect(arrived.searchParams.get('state')).toBe(request.state);
    const code = arrived.searchParams.get('code');
    expect(code).toBeTruthy();

    // The client exchanges the code, and holds only what the person left ticked.
    const token = await member.context.request.post('/api/auth/oauth2/token', {
      headers: { Origin: E2E_ORIGIN },
      form: {
        grant_type: 'authorization_code',
        code: code ?? '',
        client_id: request.clientId,
        redirect_uri: 'http://127.0.0.1:33418/callback',
        code_verifier: request.codeVerifier,
        resource: `${E2E_ORIGIN}/mcp`,
      },
    });
    expect(token.ok()).toBe(true);
    const tokens = (await token.json()) as { access_token: string; scope: string };
    expect(tokens.scope.split(' ')).toContain('read');
    expect(tokens.scope.split(' ')).not.toContain('write');

    const mcp = await member.context.request.post('/mcp', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      data: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    });
    expect(mcp.status()).toBe(200);

    // Profile → Connettori lists it, and revoking there stops the token.
    await page.unroute(/127\.0\.0\.1/);
    await page.goto('/profile/connectors');
    const row = page.getByRole('link', { name: new RegExp(clientName.replace(/[()]/g, '\\$&')) });
    await expect(row).toBeVisible();
    await expect(row).toContainText(t('web.connectors.scopeRead'));
    await expect(row).not.toContainText(t('web.connectors.scopeWrite'));
    await row.click();
    await page.getByRole('button', { name: t('web.connectors.revoke') }).click();
    await page.getByRole('button', { name: t('web.connectors.revokeConfirm') }).click();
    await expect(page).toHaveURL(/\/profile\/connectors$/);
    await expect(row).toHaveCount(0);

    const after = await member.context.request.post('/mcp', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      data: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
    });
    expect(after.status()).toBe(401);
    await member.context.close();
  });

  test('refusing on the consent page sends the client the error and says so', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, { name: 'Dino Diniego', email: 'dino@e2e.test' });
    const clientName = 'Client Rifiutato';
    const request = await startAuthorization(clientName, 'read');
    const callback = await captureCallback(member.page);
    await openConsent(member, request);
    const { page } = member;

    // Asked for `read` only: there is no write row to untick.
    await expect(
      page.getByRole('checkbox', { name: new RegExp(t('web.consent.writeTitle')) }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: t('web.consent.deny') }).click();

    const arrived = await callback();
    expect(arrived.searchParams.get('error')).toBe('access_denied');
    expect(arrived.searchParams.get('code')).toBeNull();
    await member.context.close();
  });

  test('a signed-out browser signs in first and is then taken back to the consent page', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Sara Sessione',
      email: 'sara@e2e.test',
    });
    const { page } = member;
    const request = await startAuthorization('Client Con Accesso', 'read');
    // Sign out: the cookie goes, the passkey stays on the virtual device.
    await member.context.clearCookies();
    await page.goto(request.authorizeUrl);
    // The login page arms the passkey autofill as it loads, and the authenticator answers at once.
    await expect(page).toHaveURL(/\/oauth\/consent\?/);
    await expect(page.getByRole('heading', { name: t('web.consent.title') })).toBeVisible();
    await member.context.close();
  });

  test('a consent link that was not signed by the server says it is not valid', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, { name: 'Ivo Invalido', email: 'ivo@e2e.test' });
    await member.page.goto('/oauth/consent?client_id=nessuno&scope=read');
    await expect(
      member.page.getByRole('heading', { name: t('web.consent.invalidTitle') }),
    ).toBeVisible();
    await expect(
      member.page.getByRole('link', { name: t('web.consent.backToSaldo') }),
    ).toBeVisible();
    await member.context.close();
  });

  test('with MCP off the consent page and Profile say so, and the admin can turn it on again', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, { name: 'Omar Off', email: 'omar@e2e.test' });
    const admin = await openAdmin(browser);
    const request = await startAuthorization('Client Spento', 'read');
    const mcpSwitch = admin.page.getByRole('switch', { name: t('admin.mcp.switchLabel') });

    await admin.page.goto('/admin/mcp');
    try {
      await mcpSwitch.click();
      // Off asks first, naming what stops; «Annulla» leaves it on.
      await expect(admin.page.getByText(t('admin.mcp.offTitle'))).toBeVisible();
      await admin.page.getByRole('button', { name: t('common.cancel') }).click();
      await expect(admin.page.getByText(t('admin.mcp.offTitle'))).toHaveCount(0);
      await expect(mcpSwitch).toBeChecked();

      await mcpSwitch.click();
      await admin.page.getByRole('button', { name: t('admin.mcp.turnOff') }).click();
      await expect(mcpSwitch).not.toBeChecked();

      // The authorize endpoint answers «not_found» while MCP is off, so the consent page is opened
      // directly, the way a link that was issued before the switch would.
      await member.page.goto(`/oauth/consent?client_id=${request.clientId}&scope=read`);
      await expect(
        member.page.getByRole('heading', { name: t('web.consent.disabledTitle') }),
      ).toBeVisible();
      await member.page.goto('/profile/connectors');
      await expect(member.page.getByText(t('web.connectors.offTitle'))).toBeVisible();
      expect(
        (await member.context.request.post('/mcp', { data: {}, failOnStatusCode: false })).status(),
      ).toBe(404);
    } finally {
      await admin.page.goto('/admin/mcp');
      if (!(await mcpSwitch.isChecked())) await mcpSwitch.click();
      await expect(mcpSwitch).toBeChecked();
    }
    await member.context.close();
    await admin.context.close();
  });
});
