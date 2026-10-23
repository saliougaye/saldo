'use client';

import type { ReactNode } from 'react';
import { Button } from './Button';
import styles from './FormFoot.module.css';
import { PanelLink } from './PanelNav';

interface Props {
  hint: string;
  /** No «Annulla» without it: a form in the page has nothing to close (W11). */
  cancelHref?: string;
  cancelLabel: string;
  submitLabel: string;
  busyLabel: string;
  pending: boolean;
  /** Something that belongs to the form but is not its answer (a budget's «Elimina»): the leading corner. */
  leading?: ReactNode;
}

export function FormFoot({
  hint,
  cancelHref,
  cancelLabel,
  submitLabel,
  busyLabel,
  pending,
  leading,
}: Props) {
  return (
    <div className={styles.foot}>
      {leading === undefined ? null : <div className={styles.leading}>{leading}</div>}
      <span className={styles.hint}>{hint}</span>
      {/* In a panel that lives in client state, «Annulla» closes it in place; elsewhere it is a link. */}
      {cancelHref === undefined ? null : (
        <PanelLink className={styles.cancel} href={cancelHref}>
          {cancelLabel}
        </PanelLink>
      )}
      <div>
        <Button type="submit" busy={pending} busyLabel={busyLabel}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
