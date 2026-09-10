import { sql } from 'drizzle-orm';
import type { ServerDatabase } from './types';

/**
 * §8.4: one global sequence, read per applied row. A sequence and not `max(seq) + 1`, because two
 * concurrent pushes must never mint the same cursor value — a client that pulled the lower one
 * would step over the higher one and never see it.
 */
export async function nextSeq(db: ServerDatabase): Promise<number> {
  // `execute` is typed per driver — `pg` answers a QueryResult, PGlite its own shape — so the
  // result is narrowed here rather than trusting either driver's generic.
  const result: unknown = await db.execute(sql`select nextval('sync_seq') as seq`);
  const rows =
    typeof result === 'object' && result !== null && 'rows' in result
      ? ((result as { rows: unknown }).rows as { seq?: string | number }[])
      : (result as { seq?: string | number }[]);
  const raw = rows[0]?.seq;
  if (raw === undefined) throw new Error('sync_seq returned no value');
  return typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
}
