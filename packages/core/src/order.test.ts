import { describe, expect, it } from 'vitest';
import { newestFirst } from './order';

const row = (id: string, date: string, createdAt: string) => ({ id, date, createdAt });

describe('newestFirst', () => {
  it('orders by date, then creation, then id, all descending — the phone’s query', () => {
    const rows = [
      row('a', '2026-09-01', '2026-09-01T10:00:00.000Z'),
      row('b', '2026-09-02', '2026-09-01T09:00:00.000Z'),
      row('c', '2026-09-02', '2026-09-02T09:00:00.000Z'),
      row('d', '2026-09-02', '2026-09-02T09:00:00.000Z'),
    ];
    expect([...rows].sort(newestFirst).map((r) => r.id)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('compares bytes, as SQLite’s BINARY collation does, not as ICU would', () => {
    // ICU's collation ignores punctuation at the first level and folds case: `localeCompare` puts
    // `a-b` beside `ab` and `B` beside `b`. SQLite compares code units, so `B` (0x42) < `_` (0x5F)
    // < `a` (0x61), and `-` (0x2D) sorts before every letter.
    const at = '2026-09-01T10:00:00.000Z';
    const ids = ['ab', 'a-b', 'B', '_x', 'b'];
    const sorted = ids.map((id) => row(id, '2026-09-01', at)).sort(newestFirst);
    expect(sorted.map((r) => r.id)).toEqual(['b', 'ab', 'a-b', '_x', 'B']);
  });

  it('answers 0 for the same row', () => {
    const one = row('a', '2026-09-01', '2026-09-01T10:00:00.000Z');
    expect(newestFirst(one, { ...one })).toBe(0);
  });
});
