import type { GoalProgress } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { formatMoney } from './format';
import {
  deadlineLabel,
  type GoalTextDeps,
  type GoalTextSubject,
  goalEnds,
  goalLabel,
  goalMeta,
  goalOf,
  goalSentence,
  goalStatus,
  richText,
} from './goalText';
import { catalogs } from './index';
import { makeTranslator } from './translate';

const TODAY = '2026-09-15';

const deps: GoalTextDeps = {
  t: makeTranslator(catalogs.en),
  locale: 'en',
  money: (minor) => formatMoney(minor, 'EUR', 'en'),
  today: TODAY,
  periodKind: 'month',
};

function goal(
  progress: Partial<GoalProgress>,
  account: Partial<GoalTextSubject['account']> = {},
): GoalTextSubject {
  return {
    account: { name: 'Car', goalDeadline: '2026-12-15', goalStartDate: '2026-01-10', ...account },
    progress: {
      saved: 40_000,
      target: 100_000,
      ratio: 0.4,
      missing: 60_000,
      state: 'onTrack',
      reachedOn: null,
      pace: 0.5,
      gap: 5_000,
      periodsLeft: 4,
      perPeriod: 15_000,
      daysLeft: 91,
      ...progress,
    },
  };
}

describe('deadlineLabel', () => {
  it('gives day and month within this year, and month and year after it', () => {
    expect(deadlineLabel('2026-12-15', TODAY, 'en')).toBe('Dec 15');
    expect(deadlineLabel('2027-06-30', TODAY, 'en')).toBe('June 2027');
    expect(deadlineLabel('2026-12-15', TODAY, 'it')).toBe('15 dic');
    expect(deadlineLabel('2027-06-30', TODAY, 'it')).toBe('giugno 2027');
  });
});

describe('goalStatus', () => {
  it('says one thing per state', () => {
    expect(goalStatus(goal({ state: 'reached' }), deps)).toBe('Reached');
    expect(goalStatus(goal({ state: 'expired' }), deps)).toBe('expired');
    expect(goalStatus(goal({ state: 'behind', gap: -12_345 }), deps)).toBe('€123.45 behind');
    expect(goalStatus(goal({ state: 'onTrack', gap: 5_000 }), deps)).toBe('€50.00 ahead');
    expect(goalStatus(goal({ state: 'open', missing: 60_000 }), deps)).toBe('€600.00 to go');
  });
});

describe('goalMeta', () => {
  it('reads the deadline while the goal runs, this year and after it', () => {
    expect(goalMeta(goal({}), deps)).toBe('by Dec 15');
    expect(goalMeta(goal({}, { goalDeadline: '2027-06-30' }), deps)).toBe('by June 2027');
    expect(goalMeta(goal({ state: 'open' }, { goalDeadline: null }), deps)).toBe('no deadline');
  });

  it('is short on the featured block and full on a row', () => {
    const reached = goal({ state: 'reached', reachedOn: '2026-09-02' });
    expect(goalMeta(reached, deps, true)).toBe('to close');
    expect(goalMeta(reached, deps)).toBe('reached Sep 2 · to close');
    expect(goalMeta(goal({ state: 'reached', reachedOn: null }), deps)).toBe('to close');

    const expired = goal({ state: 'expired' }, { goalDeadline: '2026-09-01' });
    expect(goalMeta(expired, deps, true)).toBe('expired');
    expect(goalMeta(expired, deps)).toBe('expired Sep 1');
  });
});

describe('goalEnds, goalOf, goalLabel', () => {
  it('labels the two ends of the bar', () => {
    expect(goalEnds(goal({}), deps)).toEqual({ start: 'Jan 10', end: 'Dec 15' });
    expect(goalEnds(goal({}, { goalStartDate: null, goalDeadline: null }), deps)).toEqual({
      start: 'Sep 15',
      end: '',
    });
  });

  it('says how far along it is, and all of it for a screen reader', () => {
    expect(goalOf(goal({}), deps)).toBe('of €1,000.00 · 40%');
    expect(goalLabel(goal({}), deps)).toBe('Car, €400.00 of €1,000.00, €50.00 ahead');
  });
});

describe('goalSentence', () => {
  const text = (subject: GoalTextSubject) => {
    const sentence = goalSentence(subject, deps);
    return [richText(sentence.action, deps.t, deps.locale), sentence.state];
  };

  it('asks for a sum per period while there is more than one left', () => {
    expect(text(goal({ state: 'behind', gap: -5_000 }))).toEqual([
      'Set aside <b>€150.00 a month</b> to get there.',
      "You're €50.00 behind.",
    ]);
    expect(text(goal({}))).toEqual([
      'Set aside <b>€150.00 a month</b> to get there.',
      "You're €50.00 ahead.",
    ]);
  });

  it('counts the days in the last period, in the plural the catalog chooses', () => {
    expect(text(goal({ periodsLeft: 1, daysLeft: 1 }))).toEqual([
      '<b>€600.00 to go in 1 day</b>.',
      null,
    ]);
    expect(text(goal({ periodsLeft: 1, daysLeft: 12 }))).toEqual([
      '<b>€600.00 to go in 12 days</b>.',
      null,
    ]);
  });

  it('says what is missing without a deadline, and what to do once expired or reached', () => {
    expect(text(goal({ state: 'open' }, { goalDeadline: null }))).toEqual([
      '<b>€600.00</b> to go.',
      null,
    ]);
    expect(text(goal({ state: 'expired' }, { goalDeadline: '2026-09-01' }))).toEqual([
      'Expired on Sep 1: <b>€600.00</b> to go.',
      'Move the deadline or close it.',
    ]);
    expect(text(goal({ state: 'reached', saved: 100_000 }))).toEqual([
      "You've set aside <b>€1,000.00</b>.",
      'Close it when you use the money.',
    ]);
  });

  it('carries the count the phone’s <Trans> needs to choose the plural itself', () => {
    const sentence = goalSentence(goal({ periodsLeft: 1, daysLeft: 12 }), deps);
    expect(sentence.action).toEqual({
      key: 'goals.lastPeriod',
      vars: { amount: '€600.00', count: 12 },
      count: 12,
    });
  });
});
