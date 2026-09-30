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
  /** The confirm button waits for something the question asks (the typed name of an account). */
  confirmDisabled?: boolean;
  /**
   * A third answer between «cancel» and the confirm button (a second way to go on, as closing a
   * goal's «Riporta in …»). It draws its own button; absent, the dialog is the plain question.
   */
  secondary?: ReactNode;
  /** A field the question needs between the body and the buttons (the archive dialog's «Sposta in»). */
  children?: ReactNode;
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
  confirmDisabled = false,
  secondary,
  children,
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
          {children}
          {error === undefined ? null : <Alert body={error} />}
          <div className={`${styles.buttons} ${secondary === undefined ? '' : styles.stacked}`}>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            {secondary}
            <Button
              busy={busy}
              busyLabel={busyLabel}
              disabled={confirmDisabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
