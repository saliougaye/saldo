'use server';

import { revalidatePath } from 'next/cache';
import { requireWebAdmin } from '../../../../src/server/auth/currentUser';
import { getDb } from '../../../../src/server/db/client';
import { instanceInfo } from '../../../../src/server/instance';
import { sendTestEmail, type TestEmailResult } from '../../../../src/server/mail/testEmail';
import { adminContext } from '../../../../src/server/page/adminContext';
import {
  removeSmtp,
  type SettingsWriteResult,
  saveInstanceName,
  saveRegistration,
  saveSmtp,
} from '../../../../src/server/settings/write';

/**
 * §17.1.8: each action resolves the admin itself, first — a layout does not run for a Server
 * Action, and this is a public endpoint whatever the page shows. The input comes from the browser,
 * so it is `unknown` until `src/server/settings/write.ts` has looked at it; `locked` is decided
 * there, from the environment, not from what the form showed. No result carries the SMTP password
 * or its envelope.
 *
 * `/admin` is revalidated as a layout: the head shows the instance name.
 */
function changed(result: SettingsWriteResult): SettingsWriteResult {
  if (result.ok) revalidatePath('/admin', 'layout');
  return result;
}

export async function saveRegistrationAction(mode: unknown): Promise<SettingsWriteResult> {
  const admin = await requireWebAdmin();
  return changed(await saveRegistration(getDb(), admin.id, mode, new Date()));
}

/** The empty string clears the name: it falls back to `WEBAUTHN_RP_NAME`. */
export async function saveInstanceNameAction(name: unknown): Promise<SettingsWriteResult> {
  const admin = await requireWebAdmin();
  return changed(await saveInstanceName(getDb(), admin.id, name, new Date()));
}

/** `password`: absent keeps the stored one, a string replaces it, `null` removes it. */
export async function saveSmtpAction(input: unknown): Promise<SettingsWriteResult> {
  const admin = await requireWebAdmin();
  return changed(await saveSmtp(getDb(), admin.id, input, new Date()));
}

export async function removeSmtpAction(): Promise<SettingsWriteResult> {
  const admin = await requireWebAdmin();
  return changed(await removeSmtp(getDb(), admin.id));
}

/**
 * Decision 9: no recipient argument. The message goes to the signed-in admin's own address, in
 * their language, with the **saved** configuration. On failure `detail` is the transport's own
 * message — shown only here, to an admin.
 */
export async function sendTestEmailAction(): Promise<TestEmailResult> {
  const admin = await requireWebAdmin();
  const db = getDb();
  const [{ t }, instance] = await Promise.all([adminContext(admin), instanceInfo(db)]);
  return sendTestEmail(db, { email: admin.email, t, instance });
}
