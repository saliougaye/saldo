import type { ReactNode } from 'react';
import styles from './Section.module.css';

interface Props {
  title: ReactNode;
  /** A link or a count on the trailing side of the title row. */
  trailing?: ReactNode;
  /** The trailing text asks for a look: «1 oltre il limite». */
  attention?: boolean;
  /** Home's density: rows carry their own space (`ListRow` `open`) instead of a gap between them. */
  open?: boolean;
  /** A link under the rows: «Tutte le transazioni», «Tutti i budget · 5». */
  more?: ReactNode;
  children: ReactNode;
}

/** An open section: a title row, one hairline under it, rows separated by space and never by lines. */
export function Section({
  title,
  trailing,
  attention = false,
  open = false,
  more,
  children,
}: Props) {
  return (
    <section className={`${styles.section} ${open ? styles.open : ''}`}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        {trailing === undefined ? null : (
          <div className={`${styles.trailing} ${attention ? styles.attention : ''}`}>
            {trailing}
          </div>
        )}
      </div>
      <div className={styles.rows}>{children}</div>
      {more === undefined ? null : <div className={styles.more}>{more}</div>}
    </section>
  );
}
