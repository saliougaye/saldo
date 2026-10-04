import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { writeTools } from '../catalogue';
import { writeToolSpecs } from './index';

const NAMES = [
  'save_transaction',
  'delete_transaction',
  'save_account',
  'archive_account',
  'save_category',
  'archive_category',
  'save_tag',
  'merge_tags',
  'delete_tag',
  'save_budget',
  'delete_budget',
  'save_goal',
  'move_goal_money',
  'close_goal',
];
const DESTRUCTIVE = [
  'delete_transaction',
  'archive_account',
  'archive_category',
  'merge_tags',
  'delete_tag',
  'delete_budget',
  'close_goal',
];
const IDEMPOTENT = [...DESTRUCTIVE, 'save_tag'];
const TAKES_AMOUNTS = [
  'save_transaction',
  'save_account',
  'save_category',
  'save_budget',
  'save_goal',
  'move_goal_money',
];
const TAKES_DATES = ['save_transaction', 'save_goal', 'move_goal_money'];

describe('the write catalogue (§17.4.2)', () => {
  it("is the fourteen write tools, in the spec's order, and is what writeTools exports", () => {
    expect(writeToolSpecs.map((spec) => spec.name)).toEqual(NAMES);
    expect(writeTools).toBe(writeToolSpecs);
  });

  it('marks every tool write-scoped, never read-only nor open-world', () => {
    for (const spec of writeToolSpecs) {
      expect(spec.scope).toBe('write');
      expect(spec.annotations.readOnlyHint).toBe(false);
      expect(spec.annotations.openWorldHint).toBe(false);
    }
  });

  it('marks exactly the deletes, archives, merge and close destructive', () => {
    const destructive = writeToolSpecs.filter((spec) => spec.annotations.destructiveHint);
    expect(destructive.map((spec) => spec.name).sort()).toEqual([...DESTRUCTIVE].sort());
    const idempotent = writeToolSpecs.filter((spec) => spec.annotations.idempotentHint);
    expect(idempotent.map((spec) => spec.name).sort()).toEqual([...IDEMPOTENT].sort());
  });

  it('takes object inputs and outputs, as MCP requires', () => {
    for (const spec of writeToolSpecs) {
      expect(spec.input).toBeInstanceOf(z.ZodObject);
      expect(spec.output).toBeInstanceOf(z.ZodObject);
    }
  });

  it('tells the model about minor units, dates and versions where they apply', () => {
    for (const spec of writeToolSpecs) {
      if (TAKES_AMOUNTS.includes(spec.name)) expect(spec.description).toMatch(/minor units/);
      if (TAKES_DATES.includes(spec.name)) expect(spec.description).toMatch(/YYYY-MM-DD/);
      if (spec.name !== 'move_goal_money') expect(spec.description).toMatch(/[uU]pdatedAt/);
      expect(spec.title.length).toBeGreaterThan(0);
    }
  });
});
