'use client';

import type { IconName } from '@saldo/ui';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import styles from './Button.module.css';
import { Icon } from './Icon';

type Variant = 'primary' | 'secondary' | 'link';

/**
 * `ComponentPropsWithRef`, not `ButtonHTMLAttributes`: a headless part (Base UI's `Menu.Item`) that
 * renders one of these hands it a `ref` and its own event handlers, and they have to reach the DOM
 * button. `className` stays out — the variants are the whole point of having this component.
 */
interface Props extends Omit<ComponentPropsWithRef<'button'>, 'className'> {
  variant?: Variant;
  icon?: IconName;
  /** While true the button is disabled and shows `busyLabel`, so the page never double-submits. */
  busy?: boolean;
  busyLabel?: string;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  icon,
  busy = false,
  busyLabel,
  children,
  disabled,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      type={type}
      className={`${styles.base} ${styles[variant]}`}
      disabled={disabled === true || busy}
      aria-busy={busy}
    >
      {icon === undefined || busy ? null : <Icon name={icon} size={18} />}
      {busy && busyLabel !== undefined ? busyLabel : children}
    </button>
  );
}
