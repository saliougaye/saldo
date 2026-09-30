import { tagSchema } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { dataWith, TAG, tx } from '../test/fixtures';
import { tagNameProblem, tagsView } from './tagsView';

const tag = (id: string, name: string) => tagSchema.parse({ ...TAG, id, name });

describe('tagsView', () => {
  it('counts the live transactions that carry each tag', () => {
    const rows = tagsView(
      dataWith(
        [
          tx({ id: 't1', amount: 100, date: '2026-09-01', tagIds: ['g1', 'g2'] }),
          tx({ id: 't2', amount: 100, date: '2026-09-02', tagIds: ['g1'] }),
          tx({
            id: 't3',
            amount: 100,
            date: '2026-09-03',
            tagIds: ['g1', 'g2'],
            deletedAt: '2026-09-04T00:00:00.000Z',
          }),
        ],
        { tags: [tag('g1', 'Vacanza'), tag('g2', 'Casa'), tag('g3', 'Mai usato')] },
      ),
    );
    expect(rows).toEqual([
      { id: 'g1', name: 'Vacanza', uses: 2 },
      { id: 'g2', name: 'Casa', uses: 1 },
      { id: 'g3', name: 'Mai usato', uses: 0 },
    ]);
  });

  it('sorts by usage, most used first, then by name', () => {
    const rows = tagsView(
      dataWith(
        [
          tx({ id: 't1', amount: 100, date: '2026-09-01', tagIds: ['z'] }),
          tx({ id: 't2', amount: 100, date: '2026-09-02', tagIds: ['z', 'b'] }),
          tx({ id: 't3', amount: 100, date: '2026-09-02', tagIds: ['a'] }),
        ],
        { tags: [tag('b', 'Bici'), tag('n', 'Niente'), tag('a', 'Auto'), tag('z', 'Zaino')] },
      ),
    );
    expect(rows.map((row) => row.name)).toEqual(['Zaino', 'Auto', 'Bici', 'Niente']);
  });

  it('is empty without tags', () => {
    expect(tagsView(dataWith([]))).toEqual([]);
  });
});

describe('tagNameProblem', () => {
  const tags = [tag('g1', 'Vacanza'), tag('g2', 'Casa')];

  it('asks for a name', () => {
    expect(tagNameProblem('  ', tags, null)).toBe('name');
  });

  it('refuses a name another tag holds, in any case', () => {
    expect(tagNameProblem(' casa ', tags, null)).toBe('taken');
    expect(tagNameProblem('CASA', tags, 'g1')).toBe('taken');
  });

  it('lets a tag keep its own name or change its case', () => {
    expect(tagNameProblem('casa', tags, 'g2')).toBeNull();
    expect(tagNameProblem('Mare', tags, null)).toBeNull();
  });
});
