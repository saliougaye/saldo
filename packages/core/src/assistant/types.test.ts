import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { emptyUserData } from '../userData';
import {
  defineReadTool,
  defineWriteToolSpec,
  READ_ANNOTATIONS,
  type ReadTool,
  type WriteToolSpec,
} from './types';

const CTX = { today: '2026-09-15', timeZone: 'Europe/Rome' };

const echo: ReadTool<{ n: number }, { doubled: number }> = {
  name: 'echo',
  title: 'Echo',
  description: 'Doubles n.',
  scope: 'read',
  input: z.object({ n: z.number().int().default(1) }),
  output: z.object({ doubled: z.number().int() }),
  annotations: READ_ANNOTATIONS,
  run: (_data, _ctx, input) => ({ doubled: input.n * 2 }),
};

describe('defineReadTool', () => {
  it('keeps the description and the schemas', () => {
    const tool = defineReadTool(echo);
    expect(tool.name).toBe('echo');
    expect(tool.scope).toBe('read');
    expect(tool.annotations).toEqual(READ_ANNOTATIONS);
    expect(tool.input).toBe(echo.input);
  });

  it('parses the input before the typed run sees it, defaults included', () => {
    const tool = defineReadTool(echo);
    expect(tool.run(emptyUserData(), CTX, { n: 4 })).toEqual({ doubled: 8 });
    expect(tool.run(emptyUserData(), CTX, {})).toEqual({ doubled: 2 });
  });

  it('refuses an input its schema refuses', () => {
    const tool = defineReadTool(echo);
    expect(() => tool.run(emptyUserData(), CTX, { n: 'four' })).toThrow();
  });
});

describe('defineWriteToolSpec', () => {
  it('keeps a write spec as it is, scope included', () => {
    const spec: WriteToolSpec<{ id: string }, { ok: boolean }> = {
      name: 'noop',
      title: 'No-op',
      description: 'Does nothing.',
      scope: 'write',
      input: z.object({ id: z.string() }),
      output: z.object({ ok: z.boolean() }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    };
    expect(defineWriteToolSpec(spec)).toBe(spec);
  });
});
