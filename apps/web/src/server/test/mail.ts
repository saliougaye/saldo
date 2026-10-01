import type { ServerDatabase } from '../db/types';
import { type MailTransportFactory, setMailTransportForTests } from '../mail/mailer';
import { mailThrottle } from '../mail/throttle';
import { saveSmtp } from '../settings/write';

export interface SentMail {
  from: string;
  to: string;
  subject: string;
  text: string;
}

export interface MailCatcher {
  sent: SentMail[];
  /** Makes every later send fail, as a server that refuses the message would. */
  failWith(error: Error | null): void;
}

/**
 * Stands in for SMTP: installs a fake transport (no test opens a socket) and forgets the throttle,
 * so each test starts with nothing sent. «Mail enabled» is a separate step, `enableMail`, because
 * most of these tests are about what happens when it is not.
 */
export function catchMail(): MailCatcher {
  const catcher: { sent: SentMail[]; error: Error | null } = { sent: [], error: null };
  const factory: MailTransportFactory = () => ({
    send: async (message) => {
      if (catcher.error !== null) throw catcher.error;
      catcher.sent.push(message);
    },
    close: () => {},
  });
  setMailTransportForTests(factory);
  mailThrottle.reset();
  return {
    sent: catcher.sent,
    failWith: (error) => {
      catcher.error = error;
    },
  };
}

export function stopCatchingMail(): void {
  setMailTransportForTests(null);
}

/** Mail is enabled the way an admin enables it: an SMTP row, written through `saveSmtp`. */
export async function enableMail(db: ServerDatabase): Promise<void> {
  const result = await saveSmtp(
    db,
    null,
    { host: 'localhost', port: 1025, from: 'Saldo <saldo@example.com>' },
    new Date(),
  );
  if (result.ok !== true) throw new Error('could not store the test SMTP row');
}
