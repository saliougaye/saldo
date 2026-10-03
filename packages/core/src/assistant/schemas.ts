import { z } from 'zod';
import { isLocalDate } from '../dates';

/** A `YYYY-MM-DD` date, checked with core's own `isLocalDate` (as `entities.ts` does). */
export const toolDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine(isLocalDate, 'Not a calendar date')
  .describe('A calendar date, YYYY-MM-DD.');

/** Both ends inclusive, as every range in Saldo. */
export const dateRangeSchema = z.object({ start: toolDateSchema, end: toolDateSchema });
