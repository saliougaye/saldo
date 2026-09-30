import { createTransport } from 'nodemailer';
import type { ServerDatabase } from '../db/types';
import { env } from '../env';
import { log } from '../log';
import { type SettingsSource, smtpForSending } from '../settings/serverSettings';

/**
 * §17.1.8, decision 8. The one way the server sends mail: `sendMail` resolves the configuration at
 * send time (so a change in the panel applies to the next message), builds a transport **for this
 * message**, sends and closes it. Plain text only.
 *
 * Results, not throws: `failed` carries the transport's own message as `detail`, which only the
 * admin's test-email panel shows. Nothing here logs the recipient, the password or the envelope —
 * a log line says that a send failed and with which error code, and nothing else.
 */
export type SendMailResult =
  | { ok: true }
  | { ok: false; error: 'notConfigured' | 'failed'; detail?: string };

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** What the transport is built from: `transportSecurity`, the timeouts and the credentials. */
export interface TransportOptions {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  auth?: { user: string; pass: string };
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
}

/** The little of a nodemailer transport this module uses, so a test can stand in for it. */
export interface MailTransport {
  send(message: { from: string; to: string; subject: string; text: string }): Promise<void>;
  close(): void;
}

export type MailTransportFactory = (options: TransportOptions) => MailTransport;

/** An unreachable host fails an action in this long instead of hanging it. */
const TIMEOUT_MS = 10_000;

/**
 * Connect and greeting bound the start of a send; this bounds every silence after it. Without it a
 * host that greets and then stalls holds the send for nodemailer's default of ten minutes, which a
 * background send (where nobody is watching) would never surface.
 */
const SOCKET_TIMEOUT_MS = 30_000;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Port 465 is implicit TLS. Any other port **requires** STARTTLS, so a password is never offered
 * over a connection that was not upgraded — except to the machine itself (a development catcher
 * such as Mailpit), where plain is allowed.
 */
export function transportSecurity(
  host: string,
  port: number,
): { secure: boolean; requireTLS: boolean } {
  if (port === 465) return { secure: true, requireTLS: false };
  return { secure: false, requireTLS: !LOCAL_HOSTS.has(host.toLowerCase()) };
}

const nodemailerFactory: MailTransportFactory = (options) => {
  const transport = createTransport(options);
  return {
    send: async (message) => {
      await transport.sendMail(message);
    },
    close: () => transport.close(),
  };
};

let factory: MailTransportFactory = nodemailerFactory;

/** Tests install a fake so none of them opens a socket; `null` puts nodemailer back. */
export function setMailTransportForTests(replacement: MailTransportFactory | null): void {
  factory = replacement ?? nodemailerFactory;
}

/** Whether `sendMail` could work: a configuration exists and its password, if any, still opens. */
export async function mailEnabled(
  db: ServerDatabase,
  source: SettingsSource = env(),
): Promise<boolean> {
  return (await smtpForSending(db, source)) !== null;
}

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error;
    if (typeof code === 'string' || typeof code === 'number') return String(code);
  }
  return 'unknown';
}

export async function sendMail(
  db: ServerDatabase,
  message: MailMessage,
  source: SettingsSource = env(),
): Promise<SendMailResult> {
  const smtp = await smtpForSending(db, source);
  if (smtp === null) return { ok: false, error: 'notConfigured' };

  const transport = factory({
    host: smtp.host,
    port: smtp.port,
    ...transportSecurity(smtp.host, smtp.port),
    ...(smtp.user !== null && smtp.password !== null
      ? { auth: { user: smtp.user, pass: smtp.password } }
      : {}),
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  });
  try {
    await transport.send({
      from: smtp.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return { ok: true };
  } catch (error) {
    // The message may name the recipient or the server's reply: it goes to the admin, not the log.
    log('mail', 'sending failed', { code: errorCode(error) });
    return {
      ok: false,
      error: 'failed',
      detail: error instanceof Error ? error.message : 'unknown error',
    };
  } finally {
    transport.close();
  }
}
