'use client';

import { type ComponentProps, useState } from 'react';
import styles from '../admin.module.css';
import { MintInvite } from './MintInvite';

interface Props {
  /** No invite yet: the page shows the form under its empty state (W11). */
  empty: boolean;
  title: string;
  mint: Omit<ComponentProps<typeof MintInvite>, 'inline' | 'onDone'>;
}

/**
 * «Crea il primo invito» in the page. The mint revalidates `/admin`, so the same answer brings a
 * list with one row and `empty` turns false — but the code lives only in `MintInvite`'s state and
 * is shown once. The form therefore stays mounted from the first render until «Fatto».
 */
export function FirstInvite({ empty, title, mint }: Props) {
  const [open, setOpen] = useState(empty);
  // Every invite gone again (a fresh database in a test, say): the form comes back.
  if (empty && !open) setOpen(true);
  if (!open) return null;
  return (
    <div className={styles.first}>
      <h3 className={styles.firstTitle}>{title}</h3>
      <MintInvite {...mint} inline onDone={() => setOpen(false)} />
    </div>
  );
}
