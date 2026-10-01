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
  it('does not make the caller wait for the task', async () => {
    let finished = false;
    let release: () => void = () => {};
    inBackground(() =>
      new Promise<void>((resolve) => {
        release = resolve;
      }).then(() => {
        finished = true;
      }),
    );
    expect(finished).toBe(false);
    release();
    await settleBackground();
    expect(finished).toBe(true);
  });

  it('runs a task with no request scope as a detached promise', async () => {
    const ran = vi.fn(async () => {});
    inBackground(ran);
    await settleBackground();
    expect(ran).toHaveBeenCalledTimes(1);
    expect(afterCalls.handed).toHaveLength(0);
  });

  it('hands the work to after() when there is a request scope', async () => {
    afterCalls.scope = true;
    const ran = vi.fn(async () => {});
    inBackground(ran);
    await settleBackground();
    expect(ran).toHaveBeenCalledTimes(1);
    expect(afterCalls.handed).toHaveLength(1);
  });

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

  it('logs a task that throws before its first await the same way', async () => {
    expect(() =>
      inBackground(() => {
        throw new Error('sync');
      }),
    ).not.toThrow();
    await settleBackground();
    expect(logged).toHaveLength(1);
  });

  it('settles tasks that start further tasks', async () => {
    const order: string[] = [];
    inBackground(async () => {
      inBackground(async () => {
        order.push('inner');
      });
      order.push('outer');
    });
    await settleBackground();
    expect([...order].sort()).toEqual(['inner', 'outer']);
  });
});
