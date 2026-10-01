import type { Translate } from '@saldo/i18n';
import { isSyntheticEmail } from '../auth/email';
import type { ServerDatabase } from '../db/types';
import { env } from '../env';
import type { InstanceInfo } from '../instance';
import type { SettingsSource } from '../settings/serverSettings';
import { sendMail } from './mailer';

export type TestEmailResult =
  | { ok: true; to: string }
  | { ok: false; error: 'syntheticEmail' | 'notConfigured' }
  | { ok: false; error: 'failed'; detail: string };

/**
 * Decision 9: «Manda un'email di prova» goes to the **signed-in admin's own address** — there is no
 * recipient to choose, so the panel cannot be used to mail a stranger — and it is written in the
 * admin's language. An admin whose address is still the placeholder is told so instead.
 */
export async function sendTestEmail(
  db: ServerDatabase,
  admin: { email: string; t: Translate; instance: InstanceInfo },
  source: SettingsSource = env(),
): Promise<TestEmailResult> {
  if (isSyntheticEmail(admin.email)) return { ok: false, error: 'syntheticEmail' };
  const vars = { instance: admin.instance.name, host: admin.instance.host };
  const sent = await sendMail(
    db,
    {
      to: admin.email,
      subject: admin.t('admin.mail.subject', vars),
      text: admin.t('admin.mail.body', vars),
    },
    source,
  );
  if (sent.ok) return { ok: true, to: admin.email };
  if (sent.error === 'notConfigured') return { ok: false, error: 'notConfigured' };
  return { ok: false, error: 'failed', detail: sent.detail ?? '' };
}
