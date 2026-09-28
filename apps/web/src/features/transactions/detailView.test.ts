import { emptyUserData } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_2, attachment, dataWith, RECURRENCE, TAG, tx } from '../test/fixtures';
import { detailView } from './detailView';

const TODAY = '2026-09-15';

describe('detailView', () => {
  it('is null for an id the account does not have', () => {
    expect(detailView({ data: emptyUserData(), id: 'nope', today: TODAY })).toBeNull();
  });

  it('names the category and the account of an expense, in the phone’s order', () => {
    const view = detailView({
      data: dataWith([tx({ id: 't1', amount: 500, date: '2026-09-10' })]),
      id: 't1',
      today: TODAY,
    });
    expect(view?.facts).toEqual([
      { kind: 'category', value: 'Spesa', href: null },
      { kind: 'account', value: 'Conto', href: '/accounts?a=a1' },
      { kind: 'date', value: '2026-09-10', href: null },
    ]);
  });

  it('titles and signs the row exactly as the list does', () => {
    const view = detailView({
      data: dataWith([tx({ id: 't1', amount: 500, date: '2026-09-10', description: 'Pane' })]),
      id: 't1',
      today: TODAY,
    });
    expect(view?.title).toBe('Pane');
    expect(view?.amount).toEqual({ minor: -500, signDisplay: 'negative', muted: false });
  });

  it('names both sides of a transfer, shows no category, and leaves its amount unsigned', () => {
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
      today: TODAY,
    });
    expect(view?.facts).toEqual([
      { kind: 'from', value: 'Conto', href: '/accounts?a=a1' },
      { kind: 'to', value: 'Risparmi', href: '/accounts?a=a2' },
      { kind: 'date', value: '2026-09-10', href: null },
    ]);
    expect(view?.amount).toEqual({ minor: 500, signDisplay: 'never', muted: true });
  });

  it('carries the note only when there is one', () => {
    const data = dataWith([
      tx({ id: 't1', amount: 500, date: '2026-09-10', note: 'Con lo sconto' }),
      tx({ id: 't2', amount: 500, date: '2026-09-10' }),
    ]);
    expect(detailView({ data, id: 't1', today: TODAY })?.facts).toContainEqual({
      kind: 'note',
      value: 'Con lo sconto',
      href: null,
    });
    expect(
      detailView({ data, id: 't2', today: TODAY })?.facts.map((fact) => fact.kind),
    ).not.toContain('note');
  });

  it('says a row is an occurrence of a recurrence, and when that recurrence ends', () => {
    const view = detailView({
      data: dataWith([tx({ id: 't1', amount: 500, date: '2026-09-10', recurrenceId: 'r1' })], {
        recurrences: [RECURRENCE],
      }),
      id: 't1',
      today: TODAY,
    });
    expect(view?.recurrenceId).toBe('r1');
    expect(view?.recurrenceEnd).toBe('2026-12-10');
  });

  it('names the tags and counts the attachments the phone holds', () => {
    const view = detailView({
      data: dataWith([tx({ id: 't1', amount: 500, date: '2026-09-10', tagIds: [TAG.id] })], {
        tags: [TAG],
        attachments: [attachment('n1', 't1'), attachment('n2', 't1'), attachment('n3', 't2')],
      }),
      id: 't1',
      today: TODAY,
    });
    expect(view?.tagNames).toEqual(['Vacanza']);
    expect(view?.attachmentCount).toBe(2);
  });

  it('says when a row is excluded from the totals, and when it is dated ahead', () => {
    const view = detailView({
      data: dataWith([tx({ id: 't1', amount: 500, date: '2026-09-20', excludeFromTotals: true })]),
      id: 't1',
      today: TODAY,
    });
    expect(view?.excluded).toBe(true);
    expect(view?.upcoming).toBe(true);
  });
});
