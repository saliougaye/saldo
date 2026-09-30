import { after } from 'next/server';
import { log } from './log';

/**
 * Work that must not hold a response up — and must not be visible in how long the response took.
 * The mail callbacks use it so «we sent it» and «we did nothing» answer in the same time.
 *
 * With a request scope the work is also handed to `after()`, which keeps a serverless function alive
 * until the promise settles; with none (a script, a test, a plain Node process) it is simply a
 * detached promise. Either way a failure is logged and swallowed: the line says that a task failed
 * and nothing else, because the error's text can carry an address.
 */
const pending = new Set<Promise<void>>();

export function inBackground(task: () => Promise<void>): void {
  const run = (async () => {
    try {
      await task();
    } catch {
      log('background', 'a background task failed');
    }
  })();
  pending.add(run);
  void run.finally(() => pending.delete(run));
  try {
    after(run);
  } catch {
    // No request scope: the promise is already running and nothing needs to keep it alive.
  }
}

/** Tests wait for what was started, instead of for time; also waits for tasks those tasks start. */
export async function settleBackground(): Promise<void> {
  while (pending.size > 0) await Promise.all([...pending]);
}
