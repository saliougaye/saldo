'use client';

import Link from 'next/link';
import { createContext, type MouseEvent, type ReactNode, useContext } from 'react';

/** What a page whose panel lives in client state gives the links inside it. */
export interface PanelNav {
  /** The row whose panel is open, or null. */
  selectedId: string | null;
  /**
   * Opens what `href` opens, in place, when only the panel changes. Answers false when going there
   * is a navigation, which the caller then makes as it always did.
   */
  go: (href: string, options?: { replace?: boolean; instant?: boolean }) => boolean;
}

export const PanelNavContext = createContext<PanelNav | null>(null);

export function usePanelNav(): PanelNav | null {
  return useContext(PanelNavContext);
}

/** A plain click. A modified one (a new tab, a new window) keeps the link's own behaviour. */
export function isPlainClick(event: MouseEvent): boolean {
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0);
}

interface Props {
  href: string;
  className?: string;
  /** Added to `className` while this link's row is the selected one. */
  selectedClassName?: string;
  /** The row this link opens: `aria-current` follows the page's selection. */
  selectId?: string;
  'aria-keyshortcuts'?: string;
  children: ReactNode;
}

/**
 * A link inside a page whose panel lives in client state (Transazioni). A plain click that only
 * changes the panel changes it in the frame of the click, and the URL follows; anything else is the
 * link it always was — outside such a page too, and with JavaScript off.
 */
export function PanelLink({
  href,
  className,
  selectedClassName,
  selectId,
  children,
  ...rest
}: Props) {
  const nav = usePanelNav();
  const selected = selectId !== undefined && nav?.selectedId === selectId;
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (nav === null || !isPlainClick(event)) return;
    if (nav.go(href)) event.preventDefault();
  };
  const classes = [className, selected ? selectedClassName : undefined].filter(Boolean).join(' ');
  return (
    <Link
      href={href}
      className={classes}
      aria-current={selected ? 'true' : undefined}
      onClick={onClick}
      {...rest}
    >
      {children}
    </Link>
  );
}
