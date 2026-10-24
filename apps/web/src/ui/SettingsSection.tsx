import type { ReactNode } from 'react';
import styles from './SettingsSection.module.css';

interface Props {
  title: string;
  /** Under the title, muted: what the section is for («Le categorie raggruppano…»). */
  lead?: ReactNode;
  /** On the title row, at the end: the section's actions, or a short count. */
  trailing?: ReactNode;
  /** The blocks of the section: `SettingsBox`es, an alert, a note. */
  children: ReactNode;
}

/**
 * W10, spec §06: a section of Profile and Admin — a bold title, an optional lead sentence under it,
 * then blocks of rows (`SettingsBox`). Below 760px the trailing part goes under the title.
 */
export function SettingsSection({ title, lead, trailing, children }: Props) {
  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        {trailing === undefined ? null : <div className={styles.trailing}>{trailing}</div>}
      </div>
      {lead === undefined ? null : <p className={styles.lead}>{lead}</p>}
      {children}
    </section>
  );
}

interface BoxProps {
  /** A second block of the same section has a small title of its own («Obiettivi chiusi»). */
  title?: string;
  /** Beside the box's title: a count. */
  trailing?: ReactNode;
  /** Under the rows, after a line: «Archiviate · 3». */
  more?: ReactNode;
  children: ReactNode;
}

/** A block of rows in a bordered box (spec §06). */
export function SettingsBox({ title, trailing, more, children }: BoxProps) {
  return (
    <div className={styles.box}>
      {title === undefined ? null : (
        <div className={styles.boxHead}>
          <h3 className={styles.boxTitle}>{title}</h3>
          {trailing === undefined ? null : <span className={styles.boxTrailing}>{trailing}</span>}
        </div>
      )}
      <div className={styles.rows}>{children}</div>
      {more === undefined ? null : <div className={styles.more}>{more}</div>}
    </div>
  );
}
