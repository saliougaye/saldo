import { describe, expect, it } from 'vitest';
import { CONTEXT, fixtureData } from '../__fixtures__/userData';
import { listTagsTool } from './listTags';

describe('list_tags', () => {
  it('lists the tags by name', () => {
    expect(listTagsTool.run(fixtureData(), CONTEXT, {})).toEqual({
      tags: [
        { id: 'g-work', name: 'Lavoro', updatedAt: expect.any(String) },
        { id: 'g-trip', name: 'Viaggio', updatedAt: expect.any(String) },
      ],
    });
  });
});
