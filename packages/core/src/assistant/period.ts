import { z } from 'zod';
import type { DateRange } from '../cycle';
import type { LocalDate } from '../dates';
import { type PeriodDef, periodContaining, shiftPeriod } from '../period';
import type { UserData } from '../userData';
import { toolDateSchema } from './schemas';
import type { ToolContext } from './types';
import { toolUser } from './user';

/** `"current"`, `"previous"`, or a date inside the period wanted — the web's `?p=`. */
export type ToolPeriodRef = 'current' | 'previous' | LocalDate;

/**
 * The period a tool reads (§17.4.2): `period`, or an explicit `from`/`to` pair, never both. One
 * flat object rather than a union, because an MCP tool's input schema has to be a JSON object
 * schema and tools add their own fields beside these three; `checkToolPeriod` enforces the rest.
 */
export type ToolPeriodInput = { period?: ToolPeriodRef; from?: LocalDate; to?: LocalDate };

const periodRef = z
  .union([z.enum(['current', 'previous']), toolDateSchema])
  .describe(
    'The app period to read: "current", "previous", or any YYYY-MM-DD date inside the period wanted. Defaults to "current".',
  );

/** The three period fields, for a tool to spread into its own input object. */
export const toolPeriodShape = {
  period: periodRef.optional(),
  from: toolDateSchema
    .optional()
    .describe('Start of an explicit date range, inclusive. Needs `to`; replaces `period`.'),
  to: toolDateSchema.optional().describe('End of an explicit date range, inclusive. Needs `from`.'),
};

/** The rules a flat object cannot say: both ends or neither, not with `period`, in order. */
export function checkToolPeriod(value: ToolPeriodInput, ctx: z.RefinementCtx): void {
  const hasFrom = value.from !== undefined;
  const hasTo = value.to !== undefined;
  if (hasFrom !== hasTo) {
    ctx.addIssue({
      code: 'custom',
      message: 'Give both from and to, or neither',
      path: [hasFrom ? 'to' : 'from'],
    });
    return;
  }
  if (hasFrom && value.period !== undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'Use either period or from/to, not both',
      path: ['period'],
    });
  }
  if (value.from !== undefined && value.to !== undefined && value.to < value.from) {
    ctx.addIssue({ code: 'custom', message: 'to must not be before from', path: ['to'] });
  }
}

export const toolPeriodInput: z.ZodType<ToolPeriodInput> = z
  .object(toolPeriodShape)
  .superRefine(checkToolPeriod);

/**
 * The range a period input names, through `period.ts` (§17.4.2). A date is not clamped to the
 * current period as the web's `periodFromParam` clamps `?p=`: the web has nothing to show ahead,
 * while a model asking what is scheduled next month should get those rows.
 */
export function resolveToolPeriod(
  input: ToolPeriodInput,
  data: UserData,
  ctx: ToolContext,
): DateRange {
  if (input.from !== undefined && input.to !== undefined) {
    return { start: input.from, end: input.to };
  }
  const { def } = toolUser(data);
  const current = periodContaining(def, ctx.today);
  const ref = input.period ?? 'current';
  if (ref === 'current') return current;
  if (ref === 'previous') return shiftPeriod(def, current, -1);
  return periodContaining(def, ref);
}

/** Whether `range` is exactly one of the app's periods, so «the previous period» means something. */
export function isWholePeriod(def: PeriodDef, range: DateRange): boolean {
  const period = periodContaining(def, range.start);
  return period.start === range.start && period.end === range.end;
}
