import { beforeEach, describe, expect, it, vi } from 'vitest';

const logged = vi.hoisted(() => [] as unknown[][]);
vi.mock('./log', () => ({
  log: (...args: unknown[]) => {
    logged.push(args);
  },
  shortId: (id: string | null | undefined) => (id ?? 'none').slice(0, 8),
}));

const afterCalls = vi.hoisted(() => ({ scope: false, handed: [] as Promise<unknown>[] }));
vi.mock('next/server', () => ({
  after: (work: Promise<unknown>) => {
    if (!afterCalls.scope) throw new Error('`after` was called outside a request scope');
    afterCalls.handed.push(work);
  },
}));

import { inBackground, settleBackground } from './background';

beforeEach(() => {
  logged.length = 0;
  afterCalls.scope = false;
  afterCalls.handed.length = 0;
});

describe('inBackground', () => {
  it('logs a failure and never throws it, with or without a scope', async () => {
    for (const scope of [false, true]) {
      afterCalls.scope = scope;
      expect(() =>
        inBackground(async () => {
          throw new Error('boom ada@example.com');
        }),
      ).not.toThrow();
      await settleBackground();
    }
    expect(logged).toHaveLength(2);
    // The error text can carry an address; the line says only that it failed.
    expect(JSON.stringify(logged)).not.toContain('ada@example.com');
    expect(JSON.stringify(logged)).not.toContain('boom');
  });
});
