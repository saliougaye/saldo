import { type HlcState, type HlcString, hlcNow, hlcReceive, isHlc } from '@saldo/core';
import { eq } from 'drizzle-orm';
import { serverClock } from '../db/schema';
import type { ServerDatabase } from '../db/types';

const CLOCK_ROW = 1;

/**
 * The clock is **instance-wide**, not per-user: every web write on this server, for every account,
 * advances the same row. A device up to 24h ahead of the server (the limit `applyPush` enforces,
 * §8.2) can therefore push every user's web stamps ahead by as much when the server receives it —
 * bounded, not eliminated, by that check.
 */

/**
 * Locks the clock row for the rest of the caller's transaction and returns its state, without
 * minting anything. Split out of `advanceClock` so a caller can take this lock **before** locking
 * the rows it is about to stamp (§17.1.3's lock order: epoch, then clock, then rows) — taking the
 * clock lock after reading the rows would let a concurrent write change a row between the read and
 * the stamp.
 */
export async function lockClock(tx: ServerDatabase): Promise<HlcState> {
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
  return { wallMs: row.wallMs, counter: row.counter, deviceId: row.deviceId };
}

/**
 * One stamp per row about to be written (§17.1.3). `seen[i]` is the `updated_at` that row has now,
 * or null for a new row: the clock **receives** it first, so the stamp is after it even when the
 * phone that wrote it runs ahead of the server. Otherwise the upsert's LWW would call the web's
 * edit stale and drop it without a word.
 *
 * Pure over the clock state it is given — it does not touch the database. The caller persists the
 * returned state with `saveClock`.
 */
export function mintStamps(
  state: HlcState,
  now: Date,
  seen: readonly (HlcString | null)[],
): { state: HlcState; stamps: HlcString[] } {
  let current = state;
  const stamps: HlcString[] = [];
  for (const previous of seen) {
    const step =
      previous !== null && isHlc(previous)
        ? hlcReceive(current, previous, now.getTime())
        : hlcNow(current, now.getTime());
    current = step.state;
    stamps.push(step.hlc);
  }
  return { state: current, stamps };
}

/** Persists the clock state `mintStamps` returned. The caller must still hold `lockClock`'s lock. */
export async function saveClock(tx: ServerDatabase, state: HlcState): Promise<void> {
  await tx
    .update(serverClock)
    .set({ wallMs: state.wallMs, counter: state.counter })
    .where(eq(serverClock.id, CLOCK_ROW));
}

/**
 * `lockClock` + `mintStamps` + `saveClock` in one call, for a caller with no rows to lock in
 * between (only `writeInTransaction` needs the split). Runs inside the caller's transaction and
 * holds the clock row's lock until it ends, so two writes never mint the same stamp.
 */
export async function advanceClock(
  tx: ServerDatabase,
  now: Date,
  seen: readonly (HlcString | null)[],
): Promise<HlcString[]> {
  const state = await lockClock(tx);
  const { state: next, stamps } = mintStamps(state, now, seen);
  await saveClock(tx, next);
  return stamps;
}
