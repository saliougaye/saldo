/**
 * The mailbox's limit, not the caller's: at most one message per kind per address per minute, and
 * five per hour per address whatever the kinds. The rate limiter counts callers; this counts the
 * recipient, so rotating IPs or addresses-to-try cannot be used to flood one person.
 *
 * Pure: the clock is passed in. In memory and per process, like the rate limiter — a second replica
 * has its own counters and so raises the real limit (see the note on `rateLimit.storage` in
 * `docs/self-hosting.md`).
 *
 * Memory is bounded two ways: an address with nothing sent in the last hour is dropped by a sweep
 * (at most one a minute), and past `maxAddresses` the least recently mailed ones go first. The cap
 * is a backstop: the rate limiter already bounds how fast new addresses can arrive.
 */
export type MailKind = 'verification' | 'recovery';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const PER_HOUR = 5;
const DEFAULT_MAX_ADDRESSES = 10_000;

interface Sent {
  kind: MailKind;
  at: number;
}

export interface MailThrottle {
  /** Whether this message may go now; when it may, it is counted. */
  allow(kind: MailKind, address: string, now: number): boolean;
  /** How many addresses are remembered. */
  size(): number;
  reset(): void;
}

export function createMailThrottle(options: { maxAddresses?: number } = {}): MailThrottle {
  const maxAddresses = options.maxAddresses ?? DEFAULT_MAX_ADDRESSES;
  // A Map iterates in insertion order; an address is re-inserted when it is mailed, so the first
  // key is always the one mailed longest ago.
  const byAddress = new Map<string, Sent[]>();
  let lastSweep = Number.NEGATIVE_INFINITY;

  function sweep(now: number): void {
    if (now - lastSweep < MINUTE_MS) return;
    lastSweep = now;
    for (const [address, sent] of byAddress) {
      if (!sent.some((entry) => now - entry.at < HOUR_MS)) byAddress.delete(address);
    }
  }

  return {
    allow(kind, address, now) {
      sweep(now);
      const key = address.trim().toLowerCase();
      const recent = (byAddress.get(key) ?? []).filter((entry) => now - entry.at < HOUR_MS);
      if (recent.some((entry) => entry.kind === kind && now - entry.at < MINUTE_MS)) return false;
      if (recent.length >= PER_HOUR) return false;
      recent.push({ kind, at: now });
      byAddress.delete(key);
      byAddress.set(key, recent);
      while (byAddress.size > maxAddresses) {
        const oldest = byAddress.keys().next();
        if (oldest.done === true) break;
        byAddress.delete(oldest.value);
      }
      return true;
    },
    size: () => byAddress.size,
    reset() {
      byAddress.clear();
      lastSweep = Number.NEGATIVE_INFINITY;
    },
  };
}

/** The process's one throttle. */
export const mailThrottle: MailThrottle = createMailThrottle();
