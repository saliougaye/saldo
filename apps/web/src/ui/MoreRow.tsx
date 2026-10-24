import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './MoreRow.module.css';

/** The class of the link a `MoreRow` holds: a `PanelLink` on the page that owns the panel, a `Link` elsewhere. */
export const moreRowLinkClassName = styles.link;

/** The inside of that link: the label, then ›. */
export function MoreRowLabel({ label }: { label: string }) {
  return (
    <>
      {label}
      <Icon name="chevR" size={15} />
    </>
  );
}

/**
 * W11: the line under a first step for the other way in — «Already have your transactions in a
 * file? Import from CSV ›», «Something else? Create a goal ›». The question on the leading side,
 * the link on the trailing one.
 */
export function MoreRow({ prompt, children }: { prompt: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span>{prompt}</span>
      {children}
    </div>
  );
}
