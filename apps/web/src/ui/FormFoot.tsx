'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from './Button';
import styles from './FormFoot.module.css';

interface Props {
  hint: string;
  cancelHref: string;
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
      <Link className={styles.cancel} href={cancelHref}>
        {cancelLabel}
      </Link>
      <div>
        <Button type="submit" busy={pending} busyLabel={busyLabel}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
