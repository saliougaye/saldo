import { catalogs } from '@saldo/i18n';
import { describe, expect, it } from 'vitest';
import { accountWriteErrors } from './writeErrors';

describe('accountWriteErrors', () => {
  const errors = accountWriteErrors(catalogs.en.web.accounts);

  it('has a non-empty line for every error and for a throw', () => {
    for (const key of [
      'invalid',
      'notFound',
      'conflict',
      'closedGoal',
      'holdsGoals',
      'parentArchived',
      'unexpected',
    ] as const) {
      expect(errors[key]).not.toBe('');
    }
  });

  it('reads the catalog line of the same name', () => {
    expect(errors.holdsGoals).toBe(catalogs.en.web.accounts.error_holdsGoals);
    expect(errors.parentArchived).toBe(catalogs.en.web.accounts.error_parentArchived);
  });
});
