'use client';

import { useRouter } from 'next/navigation';
import type { ComponentPropsWithRef, MouseEvent } from 'react';
import { useState } from 'react';
import { authClient } from '../client/authClient';
import { Button } from './Button';

interface Props extends Omit<ComponentPropsWithRef<'button'>, 'className' | 'children'> {
  label: string;
  working: string;
}

/**
 * §17.1.4. Better Auth deletes the session row and clears the cookie; `replace` so «back» does not
 * land on a page that now has no session behind it.
 *
 * The rest of the props are forwarded so the avatar menu can render this *as* its `Menu.Item`: that
 * is what puts sign-out in the popup's roving focus, rather than beside it where the arrow keys
 * never reach. `onClick` is composed rather than overwritten, since the menu sends one too.
 */
export function SignOutButton({ label, working, onClick, ...rest }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      {...rest}
      variant="secondary"
      busy={busy}
      busyLabel={working}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        setBusy(true);
        void authClient.signOut().finally(() => router.replace('/login'));
      }}
    >
      {label}
    </Button>
  );
}
