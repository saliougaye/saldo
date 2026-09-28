'use client';

import { useRouter } from 'next/navigation';
import type { ComponentPropsWithRef, MouseEvent } from 'react';
import { useState } from 'react';
import { authClient } from '../client/authClient';
import { Button } from './Button';

interface Props extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  label: string;
  working: string;
  /**
   * `button` is the page's own control. `row` is a bare `<button>` the caller dresses with its own
   * `className` — the avatar menu's rows, where `Button`'s frame would be the odd one out. `Button`
   * writes its `className` after the spread, by design, so a row cannot go through it.
   */
  variant?: 'button' | 'row';
}

/**
 * §17.1.4. Better Auth deletes the session row and clears the cookie; `replace` so «back» does not
 * land on a page that now has no session behind it.
 *
 * The remaining props are forwarded so the avatar menu can render this *as* its `Menu.Item`: that
 * is what puts sign-out in the popup's roving focus, rather than beside it where the arrow keys
 * never reach. `onClick` is composed rather than overwritten, since the menu sends one too.
 */
export function SignOutButton({
  label,
  working,
  variant = 'button',
  className,
  onClick,
  ...rest
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const signOut = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    setBusy(true);
    void authClient.signOut().finally(() => router.replace('/login'));
  };
  if (variant === 'row') {
    return (
      <button
        type="button"
        {...rest}
        className={className}
        disabled={busy}
        aria-busy={busy}
        onClick={signOut}
      >
        {busy ? working : label}
      </button>
    );
  }
  return (
    <Button {...rest} variant="secondary" busy={busy} busyLabel={working} onClick={signOut}>
      {label}
    </Button>
  );
}
