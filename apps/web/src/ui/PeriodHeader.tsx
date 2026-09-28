import type { LocalDate, PeriodDef, PeriodView } from '@saldo/core';
import { type AppLocale, formatCycleRange } from '@saldo/i18n';
import Link from 'next/link';
import { periodSteps } from '../features/period/periodParams';
import { Icon } from './Icon';
import styles from './PeriodHeader.module.css';

interface Props {
  period: PeriodView;
  def: PeriodDef;
  today: LocalDate;
  locale: AppLocale;
  /** The page the ‹ › stay on, and the parameters they must not lose. */
  path: string;
  params?: Record<string, string>;
  strings: { previous: string; next: string };
}

/** The phone's period header (§5.4), as two links and a label. No client state: the URL is the state. */
export function PeriodHeader({ period, def, today, locale, path, params = {}, strings }: Props) {
  const steps = periodSteps(def, period.range, today, path, params);
  return (
    <div className={styles.header}>
      <Link className={styles.step} href={steps.previous} aria-label={strings.previous}>
        <Icon name="chevL" size={16} />
      </Link>
      <span className={styles.label}>
        {formatCycleRange(period.range, locale, period.isCurrent ? today : undefined)}
      </span>
      {steps.next === null ? (
        <span className={`${styles.step} ${styles.disabled}`} aria-hidden="true">
          <Icon name="chevR" size={16} />
        </span>
      ) : (
        <Link className={styles.step} href={steps.next} aria-label={strings.next}>
          <Icon name="chevR" size={16} />
        </Link>
      )}
    </div>
  );
}
