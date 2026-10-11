import type { LocalDate, PeriodDef, PeriodView } from '@saldo/core';
import { type AppLocale, formatCycleRange, formatMonthLong } from '@saldo/i18n';
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
  /** After the range, under the title: «giorno 19 di 31». */
  status?: string;
  strings: { previous: string; next: string };
}

function upperFirst(text: string, locale: AppLocale): string {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/** The title says which period, the line under it exactly which days: a month is «Settembre», a week its range. */
function periodTitle(period: PeriodView, def: PeriodDef, locale: AppLocale, range: string): string {
  if (def.kind === 'month' || def.kind === 'cycle') {
    return upperFirst(formatMonthLong(period.range.end, locale), locale);
  }
  if (def.kind === 'year') return period.range.start.slice(0, 4);
  return range;
}

/** The period header (§5.4, §17.1.7): title and days on the leading side, ‹ › as one joined control. No client state: the URL is the state. */
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
  const range = formatCycleRange(period.range, locale, period.isCurrent ? today : undefined);
  const title = periodTitle(period, def, locale, range);
  const sub = title === range ? status : [range, status].filter(Boolean).join(' · ');
  return (
    <div className={styles.header}>
      <div className={styles.what}>
        <span className={styles.title}>{title}</span>
        {sub === undefined || sub === '' ? null : <span className={styles.sub}>{sub}</span>}
      </div>
      <div className={styles.stepper}>
        <Link className={styles.step} href={steps.previous} aria-label={strings.previous}>
          <Icon name="chevL" size={18} />
        </Link>
        {steps.next === null ? (
          <span className={`${styles.step} ${styles.disabled}`} aria-hidden="true">
            <Icon name="chevR" size={18} />
          </span>
        ) : (
          <Link className={styles.step} href={steps.next} aria-label={strings.next}>
            <Icon name="chevR" size={18} />
          </Link>
        )}
      </div>
    </div>
  );
}
