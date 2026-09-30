'use client';

import Link from 'next/link';
import { Button } from './Button';
import styles from './FormFoot.module.css';

interface Props {
  hint: string;
  cancelHref: string;
  cancelLabel: string;
  submitLabel: string;
  busyLabel: string;
  pending: boolean;
}

export function FormFoot({
  hint,
  cancelHref,
  cancelLabel,
  submitLabel,
  busyLabel,
  pending,
}: Props) {
  return (
    <div className={styles.foot}>
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
