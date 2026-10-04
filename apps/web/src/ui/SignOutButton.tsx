'use client';

import type { IconName } from '@saldo/ui';
import { useRouter } from 'next/navigation';
import type { ComponentPropsWithRef, MouseEvent } from 'react';
import { useState } from 'react';
import { authClient } from '../client/authClient';
import { Button } from './Button';
import { Icon } from './Icon';

interface Props extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  label: string;
  working: string;
  /**
   * `button` is the page's own control. `row` is a bare `<button>` the caller dresses with its own
   * `className` — Profilo's sub-navigation, where `Button`'s frame would be the odd one out. `Button`
   * writes its `className` after the spread, by design, so a row cannot go through it.
   */
  variant?: 'button' | 'row';
  /** Leads the label of the `row` variant. */
  icon?: IconName;
  /** Where the browser goes once the session is gone; `/login` unless a flow wants its visitor back. */
  redirectTo?: string;
}

/**
 * §17.1.4. Better Auth deletes the session row and clears the cookie; `replace` so «back» does not
 * land on a page that now has no session behind it.
 *
 * The remaining props are forwarded, and `onClick` is composed rather than overwritten, so a
 * caller can dress the bare `row` variant and still hear the click.
 */
export function SignOutButton({
  label,
  working,
  variant = 'button',
  icon,
  redirectTo = '/login',
  className,
  onClick,
  ...rest
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const signOut = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    setBusy(true);
    void authClient.signOut().finally(() => router.replace(redirectTo));
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
        {icon === undefined ? null : <Icon name={icon} size={16} />}
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
