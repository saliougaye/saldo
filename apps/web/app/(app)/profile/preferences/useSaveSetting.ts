'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { SettingInput, SettingWriteError } from '../../../../src/server/write/settings';
import { saveSettingAction } from './actions';

/** `web.preferences.error_<error>` for every error the action can return, and a throw. */
export type SettingErrors = Record<SettingWriteError | 'unexpected', string>;

/**
 * Save-on-choice, as the phone (`repos.settings.update` on tap). The choice shows at once; the
 * write follows, and `router.refresh()` re-renders the page — and the root layout, which is where
 * `lang` and `data-theme` are — with the settings as stored. A refused or thrown save says why and
 * the selection goes back to what the server last sent.
 */
export function useSaveSetting<T>(value: T, errors: SettingErrors) {
  const router = useRouter();
  // The choice made here, held against the value it replaced: once the server sends another value
  // (the refresh landed, or a phone changed it meanwhile) the override no longer applies.
  const [override, setOverride] = useState<{ from: T; to: T } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const shown = override !== null && Object.is(override.from, value) ? override.to : value;

  const save = (input: SettingInput, next: T, onSaved?: () => void) => {
    if (pending) return;
    setError(null);
    setOverride({ from: value, to: next });
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof saveSettingAction>>;
      try {
        result = await saveSettingAction(input);
      } catch {
        setOverride(null);
        setError(errors.unexpected);
        return;
      }
      if (!result.ok) {
        setOverride(null);
        setError(errors[result.error]);
        return;
      }
      onSaved?.();
      router.refresh();
    });
  };

  return { shown, error, pending, save, clearError: () => setError(null) };
}
