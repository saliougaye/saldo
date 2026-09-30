'use client';

import { AlertDialog } from '@base-ui/react';
import type { ReactNode } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import styles from './ConfirmDialog.module.css';

interface Props {
  open: boolean;
  title: string;
  body: string;
  /** Why the last confirm was refused; the dialog stays open and says it under the body. */
  error?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** While true the confirm button is disabled and says `busyLabel`. */
  busy: boolean;
  busyLabel?: string;
  /**
   * A third answer between «cancel» and the confirm button (a second way to go on, as closing a
   * goal's «Riporta in …»). It draws its own button; absent, the dialog is the plain question.
   */
  secondary?: ReactNode;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

/** The mockup's `.dialog.small`: a question, why it matters, and the two answers. */
export function ConfirmDialog({
  open,
  title,
  body,
  error,
  confirmLabel,
  cancelLabel,
  busy,
  busyLabel,
  secondary,
  onConfirm,
  onOpenChange,
}: Props) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={styles.backdrop} />
        <AlertDialog.Popup className={styles.dialog}>
          <AlertDialog.Title className={styles.title}>{title}</AlertDialog.Title>
          <AlertDialog.Description className={styles.body}>{body}</AlertDialog.Description>
          {error === undefined ? null : <Alert body={error} />}
          <div className={`${styles.buttons} ${secondary === undefined ? '' : styles.stacked}`}>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            {secondary}
            <Button busy={busy} busyLabel={busyLabel} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
