import { describe, expect, it } from 'vitest';
import { deleteTagTool, mergeTagsInput, mergeTagsTool, resolveTagInput, saveTagTool } from './tags';

describe('resolveTagInput', () => {
  it('creates with a name alone', () => {
    expect(resolveTagInput({ name: 'Lavoro' })).toEqual({
      ok: true,
      value: { action: 'create', name: 'Lavoro' },
    });
  });
  it('renames with id and updatedAt', () => {
    expect(resolveTagInput({ id: 'tag-1', updatedAt: 'hlc', name: 'Ufficio' })).toEqual({
      ok: true,
      value: { action: 'rename', id: 'tag-1', name: 'Ufficio', expectedUpdatedAt: 'hlc' },
    });
  });
  it('needs updatedAt with id', () => {
    expect(resolveTagInput({ id: 'tag-1', name: 'Ufficio' }).ok).toBe(false);
  });
});

describe('the tag specs', () => {
  it('merge asks for the source version', () => {
    expect(mergeTagsInput.safeParse({ sourceId: 'a', targetId: 'b' }).success).toBe(false);
    expect(
      mergeTagsInput.safeParse({ sourceId: 'a', sourceUpdatedAt: 'h', targetId: 'b' }).success,
    ).toBe(true);
  });
  it('save_tag is idempotent and not destructive; merge and delete are both', () => {
    expect(saveTagTool.annotations).toMatchObject({ destructiveHint: false, idempotentHint: true });
    expect(mergeTagsTool.annotations).toMatchObject({ destructiveHint: true, idempotentHint: true });
    expect(deleteTagTool.annotations).toMatchObject({ destructiveHint: true, idempotentHint: true });
  });
});
