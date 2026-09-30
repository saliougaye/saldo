import type { Translate } from '@saldo/i18n/translate';

export type AdminErrorKey = 'self' | 'notFound' | 'emailMismatch' | 'invalid' | 'unexpected';

/** One line per way an admin action can answer «no» or fail (`admin.errors.*`), for the client components. */
export type AdminErrorStrings = Record<AdminErrorKey, string>;

export function adminErrorStrings(t: Translate): AdminErrorStrings {
  return {
    self: t('admin.errors.self'),
    notFound: t('admin.errors.notFound'),
    emailMismatch: t('admin.errors.emailMismatch'),
    invalid: t('admin.errors.invalid'),
    unexpected: t('admin.errors.unexpected'),
  };
}
