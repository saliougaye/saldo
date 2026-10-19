import type { PeriodDef } from '@saldo/core';
import type { Translate } from './translate';

/**
 * What the period is, in one line: «Mese solare», or «Ciclo di stipendio · dal 27» (§5.2). The
 * start day shows for the cycle only: the other kinds have no day, and a user who tracks by
 * calendar month must not read about a cycle. Here so the phone and the web say it alike.
 */
export function periodSummary(def: PeriodDef, t: Translate): string {
  const kind = t(`period.kind_${def.kind}`);
  return def.kind === 'cycle'
    ? `${kind} · ${t('settings.cycleValue', { day: def.startDay })}`
    : kind;
}
