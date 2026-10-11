import type { BudgetView } from '@saldo/core';
import type { Translate } from '@saldo/i18n/translate';
import type { IconName } from '@saldo/ui';
import type { ReactElement } from 'react';
import { ListRow } from '../../ui/ListRow';
import { TargetRing } from '../../ui/TargetRing';
import {
  budgetColour,
  budgetLabel,
  budgetMeta,
  budgetPace,
  budgetStatus,
  budgetTone,
} from './budgetText';

/** The ring beside a budget or a goal row: the phone's `targetRingSmall`. */
export const ROW_RING = 36;

/** A CSS module's classes: the row reads `rowStatus`, `rowPercent`, `rowStatusMeta` and `rowOver`. */
export type BudgetRowStyles = Readonly<Record<string, string | undefined>>;

interface Input {
  t: Translate;
  money: (minor: number) => string;
  percent: (ratio: number) => string;
  categories: readonly { id: string; colorIndex: number }[];
  styles: BudgetRowStyles;
  /** Where a row goes; absent, the row is not a link. */
  href?: (item: BudgetView) => string;
  selectedId?: string | null;
  /** The row's whole panel key (`b:ID`), for a page whose panel lives in client state (`PanelSwitch`). */
  selectId?: (item: BudgetView) => string;
}

/**
 * The budget row Home and `/budgets` share (§5.13): the ring, the name and what is left, the
 * percentage over the state. Returns the row builder plus the pieces the featured card reuses.
 */
export function budgetRowFor({
  t,
  money,
  percent,
  categories,
  styles,
  href,
  selectedId,
  selectId,
}: Input) {
  const deps = { t, money };
  const row = (item: BudgetView): ReactElement => (
    <ListRow
      key={item.budget.id}
      open
      label={budgetLabel(item, deps)}
      href={href?.(item)}
      selected={selectedId === item.budget.id}
      selectId={selectId?.(item)}
      leading={
        <TargetRing
          size={ROW_RING}
          ratio={item.ratio}
          pace={budgetPace(item)}
          tone={budgetTone(item)}
          icon={item.budget.icon as IconName}
          colorIndex={budgetColour(item, categories)}
        />
      }
      title={item.budget.name}
      subtitle={budgetMeta(item, deps)}
      trailing={
        <span className={[styles.rowStatus, item.overLimit ? styles.rowOver : undefined].join(' ')}>
          <span className={styles.rowPercent}>{percent(item.ratio)}</span>
          <span className={styles.rowStatusMeta}>{budgetStatus(item, deps)}</span>
        </span>
      }
    />
  );
  return {
    row,
    pace: budgetPace,
    tone: budgetTone,
    colour: (item: BudgetView) => budgetColour(item, categories),
    meta: (item: BudgetView) => budgetMeta(item, deps),
    status: (item: BudgetView) => budgetStatus(item, deps),
    label: (item: BudgetView) => budgetLabel(item, deps),
  };
}
