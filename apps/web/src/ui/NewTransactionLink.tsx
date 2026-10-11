'use client';

import type { MouseEvent, ReactNode } from 'react';
import { AppLink as Link } from './AppLink';
import { isPlainClick } from './PanelNav';

/** Decision 8: «Nuova transazione» is the form on Transazioni, from any page. */
export const NEW_TRANSACTION_HREF = '/transactions?new';

/** Dispatched on `window` before going to the form: a page that can open it in place cancels it. */
export const NEW_TRANSACTION_EVENT = 'saldo:new-transaction';

/** Opens «Nuova transazione» in the page when the page can. False: it has to be a navigation. */
export function openNewTransaction(instant: boolean): boolean {
  return !window.dispatchEvent(
    new CustomEvent(NEW_TRANSACTION_EVENT, { cancelable: true, detail: { instant } }),
  );
}

/** Whether the request came from the keyboard, which opens the form without motion. */
export function wantsInstant(event: Event): boolean {
  if (!(event instanceof CustomEvent)) return false;
  const detail: unknown = event.detail;
  return (
    typeof detail === 'object' && detail !== null && 'instant' in detail && detail.instant === true
  );
}

interface Props {
  className: string | undefined;
  'aria-label'?: string;
  'aria-keyshortcuts'?: string;
  children: ReactNode;
}

/** The top bar's button and the FAB: a link to the form, which the page opens in place when it can. */
export function NewTransactionLink({ className, children, ...rest }: Props) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isPlainClick(event) && openNewTransaction(false)) event.preventDefault();
  };
  return (
    <Link className={className} href={NEW_TRANSACTION_HREF} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}
