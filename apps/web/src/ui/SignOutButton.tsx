'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '../client/authClient';
import { Button } from './Button';

/**
 * §17.1.4. Better Auth deletes the session row and clears the cookie; `replace` so «back» does not
 * land on a page that now has no session behind it.
 */
export function SignOutButton({ label, working }: { label: string; working: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      busy={busy}
      busyLabel={working}
      onClick={() => {
        setBusy(true);
        void authClient.signOut().finally(() => router.replace('/login'));
      }}
    >
      {label}
    </Button>
  );
}
