import type { ReactNode } from 'react';
import styles from './HeroBand.module.css';

interface Props {
  period: ReactNode;
  /** «Rimasto da spendere» and its figure. */
  hero: ReactNode;
  /** Entrate and Uscite, beside the hero. */
  stats: ReactNode;
  bar?: ReactNode;
  legend?: ReactNode;
  children?: ReactNode;
}

/**
 * Home's band (§17.1.7, variant «C · Aperta»): the period across the width, one figure at 56px, the
 * totals beside it, and the bar with its legend under both. No box on a wide screen; the phone's
 * hero card below the breakpoint.
 */
export function HeroBand({ period, hero, stats, bar, legend, children }: Props) {
  return (
    <section className={styles.band}>
      <div className={styles.period}>{period}</div>
      <div className={styles.hero}>{hero}</div>
      <div className={styles.stats}>{stats}</div>
      {bar === undefined ? null : <div className={styles.bar}>{bar}</div>}
      {legend === undefined ? null : <div className={styles.legend}>{legend}</div>}
      {children}
    </section>
  );
}

export function HeroFigure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.figure}>
      <span className={styles.label}>{label}</span>
      {children}
    </div>
  );
}
