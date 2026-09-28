import { emptyUserData, recurrenceSchema } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_2, attachment, dataWith, RECURRENCE, TAG, tx } from '../test/fixtures';
import { detailView } from './detailView';

describe('detailView', () => {
  it('is null for an id the account does not have', () => {
    expect(detailView({ data: emptyUserData(), id: 'nope' })).toBeNull();
  });

  it('names the category and the account of an expense, in the phone’s order', () => {
    const view = detailView({
      data: dataWith([tx({ id: 't1', amount: 500, date: '2026-09-10' })]),
      id: 't1',
    });
    expect(view?.facts).toEqual([
      { kind: 'category', value: 'Spesa', href: null },
      { kind: 'account', value: 'Conto', href: '/accounts?a=a1' },
      { kind: 'date', value: '2026-09-10', href: null },
    ]);
  });

  it('keeps the category row with no value when its category is gone, as the phone shows «—»', () => {
    const view = detailView({
      data: dataWith([tx({ id: 't1', amount: 500, date: '2026-09-10', categoryId: 'gone' })]),
      id: 't1',
    });
    expect(view?.facts[0]).toEqual({ kind: 'category', value: null, href: null });
  });

  it('leaves an account it cannot name without a value, still linked', () => {
    const view = detailView({
      data: dataWith([tx({ id: 't1', amount: 500, date: '2026-09-10', accountId: 'gone' })]),
      id: 't1',
    });
    expect(view?.facts[1]).toEqual({ kind: 'account', value: null, href: '/accounts?a=gone' });
  });

  it('titles the row as the list does, and signs the hero as the phone’s detail does', () => {
    const view = detailView({
      data: dataWith([tx({ id: 't1', amount: 500, date: '2026-09-10', description: 'Pane' })]),
      id: 't1',
    });
    expect(view?.title).toBe('Pane');
    expect(view?.hero).toEqual({ minor: -500, signDisplay: 'negative' });
  });

  it('names both sides of a transfer, and gives it the phone detail’s negative hero', () => {
    const view = detailView({
      data: dataWith([
        tx({
          id: 't1',
          amount: 500,
          date: '2026-09-10',
          kind: 'transfer',
          toAccountId: ACCOUNT_2.id,
          categoryId: null,
        }),
      ]),
      id: 't1',
    });
    expect(view?.facts).toEqual([
      { kind: 'from', value: 'Conto', href: '/accounts?a=a1' },
      { kind: 'to', value: 'Risparmi', href: '/accounts?a=a2' },
      { kind: 'date', value: '2026-09-10', href: null },
    ]);
    // The list row keeps `transactionRow`'s unsigned transfer; only the detail's hero differs.
    expect(view?.amount).toEqual({ minor: 500, signDisplay: 'never', muted: true });
    expect(view?.hero).toEqual({ minor: -500, signDisplay: 'negative' });
  });

  it('gives an income a positive, always-signed hero', () => {
    const view = detailView({
      data: dataWith([tx({ id: 't1', amount: 500, date: '2026-09-10', kind: 'income' })]),
      id: 't1',
    });
    expect(view?.hero).toEqual({ minor: 500, signDisplay: 'always' });
  });

  it('carries the note as typed, or null for the page to fill in', () => {
    const data = dataWith([
      tx({ id: 't1', amount: 500, date: '2026-09-10', note: 'Con lo sconto' }),
      tx({ id: 't2', amount: 500, date: '2026-09-10' }),
    ]);
    expect(detailView({ data, id: 't1' })?.note).toBe('Con lo sconto');
    expect(detailView({ data, id: 't2' })?.note).toBeNull();
  });

  it('resolves the recurrence a row is an occurrence of', () => {
    const view = detailView({
      data: dataWith([tx({ id: 't1', amount: 500, date: '2026-09-10', recurrenceId: 'r1' })], {
        recurrences: [RECURRENCE],
      }),
      id: 't1',
    });
    expect(view?.recurrence).toEqual({
      frequency: 'monthly',
      interval: 1,
      startDate: '2026-01-10',
      endDate: '2026-12-10',
    });
  });

  it('has no recurrence when the row it points at is gone or a tombstone', () => {
    const tombstone = recurrenceSchema.parse({
      ...RECURRENCE,
      deletedAt: '2026-09-01T00:00:00.000Z',
    });
    const row = tx({ id: 't1', amount: 500, date: '2026-09-10', recurrenceId: 'r1' });
    expect(detailView({ data: dataWith([row]), id: 't1' })?.recurrence).toBeNull();
    expect(
      detailView({ data: dataWith([row], { recurrences: [tombstone] }), id: 't1' })?.recurrence,
    ).toBeNull();
  });

  it('names the tags and counts the attachments', () => {
    const view = detailView({
      data: dataWith([tx({ id: 't1', amount: 500, date: '2026-09-10', tagIds: [TAG.id] })], {
        tags: [TAG],
        attachments: [attachment('n1', 't1'), attachment('n2', 't1'), attachment('n3', 't2')],
      }),
      id: 't1',
    });
    expect(view?.tagNames).toEqual(['Vacanza']);
    expect(view?.attachmentCount).toBe(2);
  });

  it('says when a row is excluded from the totals', () => {
    const view = detailView({
      data: dataWith([tx({ id: 't1', amount: 500, date: '2026-09-20', excludeFromTotals: true })]),
      id: 't1',
    });
    expect(view?.excluded).toBe(true);
  });
});
