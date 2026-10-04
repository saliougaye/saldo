'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './CopyField.module.css';
import { Icon } from './Icon';
import { VisuallyHidden } from './VisuallyHidden';

/** How long «Copiato» stays before the button says «Copia» again (as `MintInvite`). */
const COPIED_MS = 2000;

interface Props {
  /** What is copied, shown as it is: an address, a command line. */
  value: string;
  copyLabel: string;
  copiedLabel: string;
}

/**
 * Something to give to another program — the MCP endpoint, the `claude mcp add` line — in monospace,
 * selectable by hand, with «Copia» beside it. A clipboard refused by the browser changes nothing:
 * the value is still there to select.
 */
export function CopyField({ value, copyLabel, copiedLabel }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <div className={styles.field}>
      <code className={styles.value}>{value}</code>
      <button type="button" className={styles.copy} onClick={() => void copy()}>
        <Icon name={copied ? 'check' : 'copy'} size={16} />
        {copied ? copiedLabel : copyLabel}
      </button>
      <span role="status">
        <VisuallyHidden>{copied ? copiedLabel : ''}</VisuallyHidden>
      </span>
    </div>
  );
}
