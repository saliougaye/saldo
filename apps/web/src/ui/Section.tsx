import type { ReactNode } from 'react';
import styles from './Section.module.css';

interface Props {
  title: string;
  /** A link or a count on the trailing side of the title row. */
  trailing?: ReactNode;
  children: ReactNode;
}

/** An open section: a title row, one hairline under it, rows separated by space and never by lines. */
export function Section({ title, trailing, children }: Props) {
  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        {trailing === undefined ? null : <div className={styles.trailing}>{trailing}</div>}
      </div>
      <div className={styles.rows}>{children}</div>
    </section>
  );
}
