import { type HlcState, type HlcString, hlcNow, hlcReceive, isHlc } from '@saldo/core';
import { eq } from 'drizzle-orm';
import { serverClock } from '../db/schema';
import type { ServerDatabase } from '../db/types';

const CLOCK_ROW = 1;

/**
 * One stamp per row about to be written (§17.1.3). `seen[i]` is the `updated_at` that row has now,
 * or null for a new row: the clock **receives** it first, so the stamp is after it even when the
 * phone that wrote it runs ahead of the server. Otherwise the upsert's LWW would call the web's
 * edit stale and drop it without a word.
 *
 * Runs inside the caller's transaction and holds the clock row's lock until it ends, so two writes
 * never mint the same stamp.
 */
export async function advanceClock(
  tx: ServerDatabase,
  now: Date,
  seen: readonly (HlcString | null)[],
): Promise<HlcString[]> {
  await tx
    .insert(serverClock)
    .values({ id: CLOCK_ROW, deviceId: `server-${crypto.randomUUID()}`, wallMs: 0, counter: 0 })
    .onConflictDoNothing();
  const [row] = await tx
    .select()
    .from(serverClock)
    .where(eq(serverClock.id, CLOCK_ROW))
    .for('update');
  if (row === undefined) throw new Error('server_clock has no row');
  let state: HlcState = { wallMs: row.wallMs, counter: row.counter, deviceId: row.deviceId };
  const stamps: HlcString[] = [];
  for (const previous of seen) {
    const step =
      previous !== null && isHlc(previous)
        ? hlcReceive(state, previous, now.getTime())
        : hlcNow(state, now.getTime());
    state = step.state;
    stamps.push(step.hlc);
  }
  await tx
    .update(serverClock)
    .set({ wallMs: state.wallMs, counter: state.counter })
    .where(eq(serverClock.id, CLOCK_ROW));
  return stamps;
}
