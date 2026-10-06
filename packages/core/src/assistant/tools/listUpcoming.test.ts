import { describe, expect, it } from 'vitest';
import { CONTEXT, fixtureData } from '../__fixtures__/userData';
import { listUpcomingTool } from './listUpcoming';

describe('list_upcoming', () => {
  it('merges the one-off rows ahead of today with each live recurrence’s next date, soonest first', () => {
    const result = listUpcomingTool.run(fixtureData(), CONTEXT, {});
    // The dinner on the 25th is one-off; October's salary and rent are already materialised, but
    // they are the recurrences' own occurrences, so they come once, as the recurrence.
    expect(result.items.map((item) => [item.kind, item.id, item.date])).toEqual([
      ['transaction', 'tx-sep-dinner', '2026-09-25'],
      ['recurrence', 'r-salary', '2026-10-01'],
      ['recurrence', 'r-rent', '2026-10-05'],
    ]);
  });

  it('leaves out a row dated today: it is no longer ahead', () => {
    const result = listUpcomingTool.run(fixtureData(), { ...CONTEXT, today: '2026-09-25' }, {});
    expect(result.items.map((item) => item.id)).toEqual(['r-salary', 'r-rent']);
  });
});
