'use client';

import { useState } from 'react';
import { recoveryVerifyPath } from '../../../../src/features/auth/recoverView';
import { Button } from '../../../../src/ui/Button';

export interface ConfirmStrings {
  confirm: string;
  working: string;
}

/**
 * The one step that spends the link: a button, because a GET that only *loading* the page makes is
 * what a mail scanner or another site can make too. The library's verify endpoint only answers GET,
 * so the browser navigates to it; it redirects to the passkeys page, or back to `/recover` with
 * `?error=` when the link is used up or expired.
 */
export function ConfirmForm({ token, strings }: { token: string; strings: ConfirmStrings }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      busy={busy}
      busyLabel={strings.working}
      onClick={() => {
        setBusy(true);
        window.location.assign(recoveryVerifyPath(token));
      }}
    >
      {strings.confirm}
    </Button>
  );
}
