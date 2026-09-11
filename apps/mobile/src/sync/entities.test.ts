import { getTableName, sql } from 'drizzle-orm';
import { createTestDatabase } from '../db/testing';
import { SYNCED_ENTITY_NAMES, SYNCED_TABLES } from './entities';

describe('the synced table registry', () => {
  it('covers every entity the wire protocol names', () => {
    expect(SYNCED_ENTITY_NAMES.sort()).toEqual([
      'account',
      'attachment',
      'budget',
      'category',
      'recurrence',
      'settings',
      'tag',
      'transaction',
    ]);
  });

  it('declares `id` as the primary key of every table', () => {
    const db = createTestDatabase();
    for (const entity of SYNCED_ENTITY_NAMES) {
      const name = getTableName(SYNCED_TABLES[entity]);
      const columns = db.all(sql`select name, pk from pragma_table_info(${name})`) as {
        name: string;
        pk: number;
      }[];
      const primary = columns.filter((column) => column.pk > 0).map((column) => column.name);
      // `applyPull` upserts with `onConflictDoUpdate({ target: table.id })`, which is only a
      // last-writer-wins apply if `id` is the conflict target — a table keyed on anything else
      // would insert a duplicate instead of overwriting, and the two devices would diverge.
      expect(primary).toEqual(['id']);
    }
  });
});
