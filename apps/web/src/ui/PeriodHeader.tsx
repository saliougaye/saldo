import type { LocalDate, PeriodDef, PeriodView } from '@saldo/core';
import { type AppLocale, formatPeriodRange } from '@saldo/i18n';
import { periodSteps } from '../features/period/periodParams';
import { AppLink as Link } from './AppLink';
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
  /** How many periods after the current one `›` may reach (§17.1.7). 0 by default, as on the phone. */
  reach?: number;
  /** After the `›`, on the same row: «giorno 13 di 30», «periodo chiuso», «42 transazioni». */
  status?: string;
  strings: { previous: string; next: string };
}

/** The name between ‹ and ›: the days of the period (`1 – 30 settembre`), or the year of a yearly one. */
export function periodTitle(
  period: PeriodView,
  def: PeriodDef,
  today: LocalDate,
  locale: AppLocale,
): string {
  if (def.kind === 'year') return period.range.start.slice(0, 4);
  return formatPeriodRange(period.range, locale, today);
}

/**
 * The page head (redesign §04): «‹ 1 – 30 settembre › giorno 13 di 30» on one row. The ‹ › sit
 * beside the name they change. No client state: both steps are links, so the period survives a
 * reload and a new tab.
 */
export function PeriodHeader({
  period,
  def,
  today,
  locale,
  path,
  params = {},
  reach = 0,
  status,
  strings,
}: Props) {
  const steps = periodSteps(def, period.range, today, path, params, reach);
  return (
    <div className={styles.header}>
      <span className={styles.stepper}>
        <Link className={styles.step} href={steps.previous} aria-label={strings.previous}>
          <Icon name="chevL" size={16} className={styles.chevL} />
        </Link>
        <h1 className={styles.title}>{periodTitle(period, def, today, locale)}</h1>
        {steps.next === null ? (
          <span className={`${styles.step} ${styles.disabled}`} aria-hidden="true">
            <Icon name="chevR" size={16} className={styles.chevR} />
          </span>
        ) : (
          <Link className={styles.step} href={steps.next} aria-label={strings.next}>
            <Icon name="chevR" size={16} className={styles.chevR} />
          </Link>
        )}
      </span>
      {status === undefined || status === '' ? null : (
        <span className={styles.status}>{status}</span>
      )}
    </div>
  );
}
