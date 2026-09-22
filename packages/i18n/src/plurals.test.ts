import { describe, expect, it } from 'vitest';
import { withManyPlurals } from './plurals';

describe('withManyPlurals', () => {
  it('gives every _other a _many sibling and leaves the rest alone', () => {
    const source = { a: { n_one: 'one', n_other: 'other', plain: 'x' }, top_other: 'o' };
    expect(withManyPlurals(source)).toEqual({
      a: { n_one: 'one', n_other: 'other', n_many: 'other', plain: 'x' },
      top_other: 'o',
      top_many: 'o',
    });
    expect(source.a).not.toHaveProperty('n_many');
  });
});
