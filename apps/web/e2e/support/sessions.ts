import { Client } from 'pg';
import { serverEnv } from '../env';

/**
 * Makes every session of an account look older, as if a passkey ceremony had made it `minutes`
 * ago. The change of an email address asks for a ceremony in the last 5 minutes, and a test cannot
 * wait that long. Only `created_at` moves: it is the clock of the rule.
 */
export async function ageSessions(userId: string, minutes: number): Promise<void> {
  const client = new Client({ connectionString: serverEnv.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      "update session set created_at = created_at - ($2::int * interval '1 minute') where user_id = $1",
      [userId, minutes],
    );
  } finally {
    await client.end();
  }
}
