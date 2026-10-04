import { z } from 'zod';
import { LANGUAGE_PREFERENCES } from '../../entities';
import { getCurrency } from '../../money';
import { PERIOD_KINDS, periodContaining, shiftPeriod } from '../../period';
import { dateRangeSchema, toolDateSchema } from '../schemas';
import { READ_ANNOTATIONS, type ReadTool } from '../types';
import { toolUser } from '../user';

const input = z.object({});

const output = z.object({
  today: toolDateSchema,
  timeZone: z.string(),
  onboarded: z.boolean(),
  language: z.enum(LANGUAGE_PREFERENCES),
  currency: z.string(),
  currencyMinorDigits: z.number().int(),
  period: z.object({
    kind: z.enum(PERIOD_KINDS),
    cycleStartDay: z.number().int().nullable(),
    current: dateRangeSchema,
    previous: dateRangeSchema,
  }),
});

export type GetPreferencesInput = z.infer<typeof input>;
export type GetPreferencesOutput = z.infer<typeof output>;

export const getPreferencesTool: ReadTool<GetPreferencesInput, GetPreferencesOutput> = {
  name: 'get_preferences',
  title: 'Preferences',
  description:
    "The user's preferences, as set in Saldo's Profile › Preferences, plus where today falls: their today and time zone, their currency, how they track periods (calendar month, ISO week, calendar year, or a pay cycle starting on a given day) with the current and previous period's bounds, and their language. Call it first when a question depends on dates.",
  scope: 'read',
  input,
  output,
  annotations: READ_ANNOTATIONS,
  run(data, ctx) {
    const user = toolUser(data);
    const current = periodContaining(user.def, ctx.today);
    return {
      today: ctx.today,
      timeZone: ctx.timeZone,
      onboarded: user.onboarded,
      language: user.settings.language,
      currency: user.currency,
      currencyMinorDigits: getCurrency(user.currency).minorDigits,
      period: {
        kind: user.def.kind,
        cycleStartDay: user.def.kind === 'cycle' ? user.def.startDay : null,
        current,
        previous: shiftPeriod(user.def, current, -1),
      },
    };
  },
};
