import type { Settings } from '../entities';
import type { CurrencyCode } from '../money';
import type { PeriodDef } from '../period';
import { readSettings, type UserData } from '../userData';
import { type Money, toMoney } from './money';

/** What every tool reads from `settings` before it looks at a row. */
export interface ToolUser {
  settings: Settings;
  /** `false` while there is no `settings` row (§17.1.2): the defaults stand in. */
  onboarded: boolean;
  def: PeriodDef;
  currency: CurrencyCode;
  money(minor: number): Money;
}

/**
 * The user's settings as the pages read them (`pageState` in `apps/web`): `readSettings`, so a
 * missing row or an unreadable field falls back to its default instead of failing the tool.
 */
export function toolUser(data: UserData): ToolUser {
  const settings = readSettings(data.settings);
  return {
    settings,
    onboarded: data.settings !== null,
    def: { kind: settings.periodKind, startDay: settings.cycleStartDay },
    currency: settings.currency,
    money: (minor) => toMoney(minor, settings.currency),
  };
}
