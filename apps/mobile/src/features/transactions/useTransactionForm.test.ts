import { emptyForm } from '@saldo/core';
import { detailsAreEmpty, detailsOpenInitially, detailsSummary } from './useTransactionForm';

const TODAY = '2026-04-18';

describe('the details disclosure', () => {
  const base = emptyForm(TODAY, 'acc-1');

  it('counts what it is holding', () => {
    const summary = detailsSummary({ ...base, tagIds: ['t1', 't2'], excludeFromTotals: false }, 3);
    expect(summary).toEqual({ tags: 2, attachments: 3, excludeFromTotals: false });
  });

  it('no longer counts the recurrence, which has its own row in the form', () => {
    const withRule = {
      ...base,
      recurrence: { frequency: 'weekly' as const, interval: 2, endDate: null },
    };
    expect(detailsAreEmpty(detailsSummary(withRule, 0))).toBe(true);
  });

  it('is empty when nothing in it is set', () => {
    expect(detailsAreEmpty(detailsSummary(base, 0))).toBe(true);
  });

  it('is not empty when only the exclude switch is on', () => {
    expect(detailsAreEmpty(detailsSummary({ ...base, excludeFromTotals: true }, 0))).toBe(false);
  });

  it('is not empty when only an attachment is there', () => {
    expect(detailsAreEmpty(detailsSummary(base, 1))).toBe(false);
  });

  it('starts closed on a new transaction, which has nothing in it', () => {
    expect(detailsOpenInitially('new', detailsSummary(base, 0))).toBe(false);
  });

  it('stays closed on a new transaction even if a default put something in it', () => {
    // A "duplicate this" entry point could pre-set a tag; the form still has to fit.
    expect(detailsOpenInitially('new', detailsSummary({ ...base, tagIds: ['t1'] }, 0))).toBe(false);
  });

  it('opens on an edit that has something in it, which is what you came back for', () => {
    expect(detailsOpenInitially('edit', detailsSummary({ ...base, tagIds: ['t1'] }, 0))).toBe(true);
  });

  it('stays closed on an edit with nothing in it', () => {
    expect(detailsOpenInitially('edit', detailsSummary(base, 0))).toBe(false);
  });
});
