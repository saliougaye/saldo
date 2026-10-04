import { z } from 'zod';
import { goalViews } from '../../views/goalViews';
import { moneySchema } from '../money';
import { rowVersionSchema, toolDateSchema } from '../schemas';
import { READ_ANNOTATIONS, type ReadTool } from '../types';
import { toolUser } from '../user';

const input = z.object({});

const output = z.object({
  goals: z.array(
    z.object({
      id: z.string().describe('The pocket account that holds the goal.'),
      name: z.string(),
      parentAccountId: z.string().nullable(),
      parentAccountName: z.string().nullable(),
      target: moneySchema,
      saved: moneySchema,
      missing: moneySchema,
      ratio: z.number().describe('Saved over target, 0 to 1.'),
      state: z.enum(['reached', 'expired', 'behind', 'onTrack', 'open']),
      startDate: toolDateSchema.nullable(),
      deadline: toolDateSchema.nullable(),
      reachedOn: toolDateSchema.nullable(),
      perPeriod: moneySchema
        .nullable()
        .describe('What to set aside each period to reach the target by the deadline.'),
      periodsLeft: z.number().int().nullable(),
      daysLeft: z.number().int().nullable(),
      updatedAt: rowVersionSchema,
    }),
  ),
});

export type ListGoalsInput = z.infer<typeof input>;
export type ListGoalsOutput = z.infer<typeof output>;

export const listGoalsTool: ReadTool<ListGoalsInput, ListGoalsOutput> = {
  name: 'list_goals',
  title: 'Goals',
  description:
    'The open savings goals. Each goal is a pocket: money set aside inside one of the accounts. Gives what is saved against the target, the state ("onTrack", "behind", "reached", "expired", or "open" without a deadline) and what to set aside each period to make the deadline.',
  scope: 'read',
  input,
  output,
  annotations: READ_ANNOTATIONS,
  run(data, ctx) {
    const user = toolUser(data);
    return {
      goals: goalViews(data.accounts, data.transactions, ctx.today, user.def).map(
        ({ account, parent, progress }) => ({
          id: account.id,
          name: account.name,
          parentAccountId: account.parentAccountId ?? null,
          parentAccountName: parent?.name ?? null,
          target: user.money(progress.target),
          saved: user.money(progress.saved),
          missing: user.money(progress.missing),
          ratio: progress.ratio,
          state: progress.state,
          startDate: account.goalStartDate ?? null,
          deadline: account.goalDeadline ?? null,
          reachedOn: progress.reachedOn,
          perPeriod: progress.perPeriod === null ? null : user.money(progress.perPeriod),
          periodsLeft: progress.periodsLeft,
          daysLeft: progress.daysLeft,
          updatedAt: account.updatedAt,
        }),
      ),
    };
  },
};
