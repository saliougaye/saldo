import { ownershipVerdict } from './deviceOwner';

describe('ownershipVerdict', () => {
  it('keeps the data when the same account comes back', () => {
    expect(ownershipVerdict('ada', 'ada', true)).toBe('keep');
  });

  it('calls out a different account on a phone that holds rows', () => {
    expect(ownershipVerdict('ada', 'bob', true)).toBe('foreign-data');
  });

  it('adopts an install that has never recorded an account', () => {
    // A fresh install, and every install that predates this check: there is no evidence the rows
    // belong to somebody else, so accusing their owner of being a stranger would be wrong.
    expect(ownershipVerdict(null, 'ada', true)).toBe('keep');
    expect(ownershipVerdict(null, 'ada', false)).toBe('keep');
  });

  it('says nothing when there is nothing to lose', () => {
    // An empty database after a reset. Asking somebody who has just signed in whether to delete
    // nothing is a question with one answer, so it is not put.
    expect(ownershipVerdict('ada', 'bob', false)).toBe('keep');
    expect(ownershipVerdict('ada', 'ada', false)).toBe('keep');
  });
});
