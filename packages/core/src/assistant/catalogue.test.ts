import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { emptyUserData } from '../userData';
import { CONTEXT, cycleData, fixtureData } from './__fixtures__/userData';
import { readTools, writeTools } from './catalogue';
import { READ_ANNOTATIONS } from './types';

describe('readTools', () => {
  it('holds the eleven read tools of §17.4.2, in order', () => {
    expect(readTools.map((tool) => tool.name)).toEqual([
      'get_preferences',
      'list_accounts',
      'list_categories',
      'list_tags',
      'list_transactions',
      'get_period_summary',
      'spending_by_category',
      'list_budgets',
      'list_goals',
      'list_upcoming',
      'get_forecast',
    ]);
  });

  it.each(readTools.map((tool) => [tool.name, tool] as const))(
    '%s is a read tool with a title and an English description',
    (_name, tool) => {
      expect(tool.scope).toBe('read');
      expect(tool.annotations).toEqual(READ_ANNOTATIONS);
      expect(tool.name).toMatch(/^[a-z]+(_[a-z]+)*$/);
      expect(tool.title.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(40);
    },
  );

  it.each(readTools.map((tool) => [tool.name, tool] as const))(
    '%s has object schemas an MCP client can read',
    (_name, tool) => {
      expect(z.toJSONSchema(tool.input, { io: 'input' }).type).toBe('object');
      expect(z.toJSONSchema(tool.output).type).toBe('object');
    },
  );

  it.each(readTools.map((tool) => [tool.name, tool] as const))(
    '%s answers an empty input with what its output schema accepts',
    (_name, tool) => {
      for (const data of [fixtureData(), cycleData(), emptyUserData()]) {
        const result = tool.output.safeParse(tool.run(data, CONTEXT, {}));
        expect(result.error).toBeUndefined();
      }
    },
  );

  it('refuses an input outside a tool’s schema', () => {
    const list = readTools.find((tool) => tool.name === 'list_transactions');
    expect(() => list?.run(fixtureData(), CONTEXT, { limit: 500 })).toThrow();
    expect(() => list?.run(fixtureData(), CONTEXT, { from: '2026-09-01' })).toThrow();
  });
});

describe('writeTools', () => {
  it('holds the fourteen write tools of 0.4b, none sharing a name with a read tool', () => {
    expect(writeTools).toHaveLength(14);
    const readNames = new Set(readTools.map((tool) => tool.name));
    for (const spec of writeTools) expect(readNames.has(spec.name)).toBe(false);
  });
});
