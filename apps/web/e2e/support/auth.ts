import { createServer, type Server, type Socket } from 'node:net';
import type { Browser, Page } from '@playwright/test';
import type { Translate } from '@saldo/i18n';
import { clientHeaders, E2E_ORIGIN } from '../env';
import { addVirtualAuthenticator, type VirtualAuthenticator } from './authenticator';
import { ADMIN_STORAGE } from './state';

/** `/register`, step 1: the name and the email, then «Continua». */
export async function fillIdentity(
  page: Page,
  t: Translate,
  who: { name: string; email: string },
): Promise<void> {
  await page.getByLabel(t('web.auth.nameLabel')).fill(who.name);
  await page.getByLabel(t('web.auth.emailLabel')).fill(who.email);
  await page.getByRole('button', { name: t('common.continue') }).click();
}

/** `/register`, step 2: the invite code, then «Continua». */
export async function fillInvite(page: Page, t: Translate, code: string): Promise<void> {
  await page.getByLabel(t('web.auth.inviteLabel')).fill(code);
  await page.getByRole('button', { name: t('common.continue') }).click();
}

/** The alert that carries `title`. Next's route announcer is a `role="alert"` too, so filter by text. */
export function alertWith(page: Page, title: string) {
  return page.getByRole('alert').filter({ hasText: title });
}

/** «Esci», at the end of Profilo's sub-navigation. Lands on `/login`. */
export async function signOut(page: Page, t: Translate): Promise<void> {
  await page.goto('/profile/passkeys');
  await page.getByRole('button', { name: t('sync.signOut') }).click();
  await page.waitForURL(/\/login$/);
}

/** One message the mail sink received. */
export interface SinkMail {
  to: string;
  subject: string;
  /** The decoded plain-text body. */
  text: string;
}

export interface MailSink {
  port: number;
  mails: SinkMail[];
  /** The first mail to `to` whose body matches `body`; waits up to `timeoutMs`. */
  waitFor: (to: string, body: RegExp, timeoutMs?: number) => Promise<SinkMail>;
  close: () => Promise<void>;
}

/** Quoted-printable, as nodemailer writes a long line: `=3D` for «=», and `=` at the end of a line joins it. */
function decodeQuotedPrintable(body: string): string {
  return body
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/g, (_whole, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
}

function parseMail(raw: string, to: string): SinkMail {
  const split = raw.indexOf('\r\n\r\n');
  const head = raw.slice(0, split).replace(/\r\n[ \t]+/g, ' ');
  const body = raw.slice(split + 4);
  const subject = /^Subject: (.*)$/im.exec(head)?.[1] ?? '';
  const encoding = /^Content-Transfer-Encoding: (\S+)/im.exec(head)?.[1]?.toLowerCase();
  const text = encoding === 'quoted-printable' ? decodeQuotedPrintable(body) : body;
  // The subject may be an RFC 2047 word when it holds non-ASCII: tests match on the body.
  return { to, subject, text: Buffer.from(text, 'latin1').toString('utf8') };
}

/**
 * A mail server that accepts everything and keeps it, on localhost: the admin points «Email (SMTP)»
 * at it, so the flows that send a link (verification, recovery) can be followed to the end. Plain
 * SMTP, no STARTTLS and no login: `transportSecurity` allows that to the machine itself.
 */
export async function startMailSink(): Promise<MailSink> {
  const mails: SinkMail[] = [];
  const sockets = new Set<Socket>();
  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.setEncoding('latin1');
    let buffer = '';
    let inData = false;
    let recipient = '';
    const reply = (line: string) => socket.write(`${line}\r\n`);
    reply('220 localhost ESMTP sink');
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      for (;;) {
        if (inData) {
          const end = buffer.indexOf('\r\n.\r\n');
          if (end === -1) return;
          const raw = buffer.slice(0, end).replace(/\r\n\.\./g, '\r\n.');
          buffer = buffer.slice(end + 5);
          inData = false;
          mails.push(parseMail(raw, recipient));
          reply('250 queued');
          continue;
        }
        const eol = buffer.indexOf('\r\n');
        if (eol === -1) return;
        const line = buffer.slice(0, eol);
        buffer = buffer.slice(eol + 2);
        const command = line.slice(0, 4).toUpperCase();
        if (command === 'EHLO') reply('250 localhost');
        else if (command === 'HELO') reply('250 localhost');
        else if (command === 'MAIL') reply('250 ok');
        else if (command === 'RCPT') {
          recipient = /<([^>]*)>/.exec(line)?.[1] ?? '';
          reply('250 ok');
        } else if (command === 'DATA') {
          inData = true;
          reply('354 go ahead');
        } else if (command === 'QUIT') {
          reply('221 bye');
          socket.end();
        } else reply('250 ok');
      }
    });
    socket.on('error', () => undefined);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  return {
    port,
    mails,
    waitFor: async (to, body, timeoutMs = 15_000) => {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const found = mails.find(
          (mail) => mail.to.toLowerCase() === to.toLowerCase() && body.test(mail.text),
        );
        if (found !== undefined) return found;
        if (Date.now() > deadline) throw new Error(`no mail to ${to} matching ${body}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        for (const socket of sockets) socket.destroy();
      }),
  };
}

/** The first `http(s)://` address in a mail body. */
export function linkIn(mail: SinkMail): string {
  const link = /https?:\/\/\S+/.exec(mail.text)?.[0];
  if (link === undefined) throw new Error('the mail has no link');
  return link;
}

/**
 * Lets the page register a second passkey. The page's request excludes the credentials it already
 * holds, and a virtual authenticator that holds one answers «already registered» — as a real device
 * does, which is why a person adds the second passkey from another device. So the first
 * authenticator steps aside for the ceremony; `restore` puts its credentials back on the new one.
 */
export async function withAnotherDevice(
  page: Page,
  first: VirtualAuthenticator,
): Promise<{ second: VirtualAuthenticator; restore: () => Promise<void> }> {
  const kept = await first.credentials();
  await first.remove();
  const second = await addVirtualAuthenticator(page);
  return {
    second,
    restore: async () => {
      for (const credential of kept) await second.add(credential);
    },
  };
}

/** The admin's own session in a page of its own. */
async function adminPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    storageState: ADMIN_STORAGE,
    locale: 'it-IT',
    baseURL: E2E_ORIGIN,
    extraHTTPHeaders: clientHeaders(),
  });
  return context.newPage();
}

/**
 * Admin → Impostazioni → Email (SMTP): points the instance at `port` on this machine, the way the
 * admin does. The instance sends mail from then on, which turns `/recover` on. Pair it with
 * `clearSmtp` in a `finally`: the setting belongs to the whole instance, and other specs expect none.
 */
export async function configureSmtp(browser: Browser, t: Translate, port: number): Promise<void> {
  const page = await adminPage(browser);
  try {
    await page.goto('/admin/settings?edit=smtp');
    await page.getByLabel(t('admin.settings.smtp.host'), { exact: true }).fill('127.0.0.1');
    await page.getByLabel(t('admin.settings.smtp.port')).fill(String(port));
    await page.getByLabel(t('admin.settings.smtp.from')).fill('saldo@e2e.test');
    await page.getByRole('button', { name: t('common.save'), exact: true }).click();
    await page
      .getByRole('status')
      .filter({ hasText: t('admin.settings.saved') })
      .waitFor();
  } finally {
    await page.context().close();
  }
}

/** Undoes `configureSmtp`. */
export async function clearSmtp(browser: Browser, t: Translate): Promise<void> {
  const page = await adminPage(browser);
  try {
    await page.goto('/admin/settings?edit=smtp');
    await page.getByRole('button', { name: t('admin.settings.smtp.remove') }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: t('admin.settings.smtp.removeConfirm') })
      .click();
    await page.getByRole('alertdialog').waitFor({ state: 'detached' });
  } finally {
    await page.context().close();
  }
}
