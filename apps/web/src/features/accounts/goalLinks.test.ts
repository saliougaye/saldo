import { describe, expect, it } from 'vitest';
import { goalPrefillFrom } from './goalLinks';

describe('goalPrefillFrom', () => {
  it('takes a name and a whole target in minor units', () => {
    expect(goalPrefillFrom({ name: ' Vacanze ', target: '150000' }, 2)).toEqual({
      name: 'Vacanze',
      buffer: '1500',
    });
  });

  it('cuts a long name and drops a target that is not a positive whole number', () => {
    expect(goalPrefillFrom({ name: 'x'.repeat(200), target: '-5' }, 2)).toEqual({
      name: 'x'.repeat(60),
    });
    for (const target of ['abc', '0', '1.5', '', '99999999999999999999']) {
      expect(goalPrefillFrom({ target }, 2)).toBeUndefined();
    }
  });
});
