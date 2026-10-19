import { eq } from 'drizzle-orm';
import { user } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import type { SentMail } from './mail';
import { createTestSession, type TestSession } from './session';

/** A signed-in account that already has a real address, as one that registered on the web has. */
export async function sessionWithEmail(
  db: ServerDatabase,
  email: string,
  options: { verified?: boolean } = {},
): Promise<TestSession> {
  const session = await createTestSession(db, 'Ada');
  await db
    .update(user)
    .set({ email, emailVerified: options.verified ?? true })
    .where(eq(user.id, session.userId));
  return session;
}

/** The token in the link of a change-of-address mail. */
export function changeTokenIn(mail: SentMail | undefined): string {
  const link = mail?.text.split('\n').find((line) => line.startsWith('http'));
  const token = link === undefined ? null : new URL(link).searchParams.get('token');
  if (token === null) throw new Error('no change link in the mail');
  return token;
}
