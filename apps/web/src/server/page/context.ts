import {
  type CurrencyCode,
  type LocalDate,
  type PeriodDef,
  readSettings,
  type Settings,
  type UserData,
} from '@saldo/core';
import { redirect } from 'next/navigation';
import {
  PERIOD_PARAM,
  periodFromParam,
  type WebPeriodView,
} from '../../features/period/periodParams';
import { userI18n, type WebI18n } from '../../i18n/server';
import { requireWebUser } from '../auth/currentUser';
import { env } from '../env';
import { loadUserData } from '../userData/load';
import { todayFor } from '../userData/today';

export interface PageState {
  settings: Settings;
  /** `false` when there is no `settings` row: the account has never onboarded (§17.1.2). */
  onboarded: boolean;
  def: PeriodDef;
  currency: CurrencyCode;
  today: LocalDate;
  timeZone: string;
  period: WebPeriodView;
}

/**
 * Everything a read screen needs before it looks at a single transaction, in one place so no page
 * invents its own «today» or its own period. Pure: the caller supplies the projection and the clock.
 */
export function pageState(input: {
  data: UserData;
  now: Date;
  fallbackTimeZone: string;
  params: Record<string, string | undefined>;
}): PageState {
  const settings = readSettings(input.data.settings);
  const { today, timeZone } = todayFor(settings, input.fallbackTimeZone, input.now);
  const def: PeriodDef = { kind: settings.periodKind, startDay: settings.cycleStartDay };
  return {
    settings,
    onboarded: input.data.settings !== null,
    def,
    currency: settings.currency,
    today,
    timeZone,
    period: periodFromParam(def, today, input.params[PERIOD_PARAM]),
  };
}

/**
 * Next's `searchParams`, as the one value each of our parameters means. A repeated key (`?t=a&t=b`,
 * which a hand-edited or a duplicated query string produces) keeps its **first** value: joining
 * would invent a value nothing reads, and dropping it would ignore what the user typed.
 */
export function narrowParams(
  params: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  const narrowed: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    narrowed[key] = Array.isArray(value) ? value[0] : value;
  }
  return narrowed;
}

export interface PageContext extends PageState, WebI18n {
  /** `role` was read with the session: good for a render, not for a Server Action (`isAdmin`). */
  user: { id: string; displayName: string; email: string; role: string | null };
  data: UserData;
  /** The query narrowed once, for the parameters a page reads itself (`?t=`, `?q=`, `?a=`…). */
  params: Record<string, string | undefined>;
}

/**
 * The whole beginning of a page under `(app)`, so its first line is `await readPage(searchParams)`
 * and nothing else. It takes the promise Next hands the page and narrows the query **here**: a page
 * that awaited it a second time could narrow it differently. `loadUserData` is shared with the layout.
 *
 * An account with no `settings` row has never onboarded (§17.1.2): every page sends it to
 * `/onboarding` before it builds the page state. `redirect` throws, so nothing after it runs.
 */
export async function readPage(
  searchParams: Promise<Record<string, string | string[] | undefined>>,
): Promise<PageContext> {
  // Start together what does not depend on each other. The query does not depend on the user, and
  // `userI18n` awaits the same `cache()`d `loadUserData`, so it adds no query.
  const [user, rawParams] = await Promise.all([requireWebUser(), searchParams]);
  const [data, i18n] = await Promise.all([loadUserData(user.id), userI18n(user.id)]);
  if (data.settings === null) redirect('/onboarding');
  const params = narrowParams(rawParams);
  return {
    ...pageState({ data, now: new Date(), fallbackTimeZone: env().defaultTimeZone, params }),
    ...i18n,
    user: { id: user.id, displayName: user.displayName, email: user.email, role: user.role },
    data,
    params,
  };
}
