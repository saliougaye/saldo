import { ownershipVerdict } from './deviceOwner';

describe('ownershipVerdict', () => {
  it('keeps the data when the same account comes back', () => {
    expect(ownershipVerdict('ada', 'ada', true)).toBe('keep');
  });

  it('calls out a different account on a phone that holds rows', () => {
    expect(ownershipVerdict('ada', 'bob', true)).toBe('foreign-data');
  });

  it('asks about rows that belong to no account yet', () => {
    // A phone started without a server (§6.29 step 0), and every install that predates this
    // check: the rows are nobody else's, but whether they join this account is the user's call.
    expect(ownershipVerdict(null, 'ada', true)).toBe('unowned-data');
  });

  it('adopts a fresh install silently: there is nothing to decide', () => {
    expect(ownershipVerdict(null, 'ada', false)).toBe('keep');
  });

  it('says nothing when there is nothing to lose', () => {
    // An empty database after a reset. Asking somebody who has just signed in whether to delete
    // nothing is a question with one answer, so it is not put.
    expect(ownershipVerdict('ada', 'bob', false)).toBe('keep');
    expect(ownershipVerdict('ada', 'ada', false)).toBe('keep');
  });
});
