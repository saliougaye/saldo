import { getForecastTool } from './tools/getForecast';
import { getPeriodSummaryTool } from './tools/getPeriodSummary';
import { getPreferencesTool } from './tools/getPreferences';
import { listAccountsTool } from './tools/listAccounts';
import { listBudgetsTool } from './tools/listBudgets';
import { listCategoriesTool } from './tools/listCategories';
import { listGoalsTool } from './tools/listGoals';
import { listTagsTool } from './tools/listTags';
import { listTransactionsTool } from './tools/listTransactions';
import { listUpcomingTool } from './tools/listUpcoming';
import { spendingByCategoryTool } from './tools/spendingByCategory';
import { type AnyReadTool, type AnyWriteToolSpec, defineReadTool } from './types';
import { writeToolSpecs } from './write';

/** The read tools of §17.4.2, in the order a client lists them. Scope `read`. */
export const readTools: readonly AnyReadTool[] = [
  defineReadTool(getPreferencesTool),
  defineReadTool(listAccountsTool),
  defineReadTool(listCategoriesTool),
  defineReadTool(listTagsTool),
  defineReadTool(listTransactionsTool),
  defineReadTool(getPeriodSummaryTool),
  defineReadTool(spendingByCategoryTool),
  defineReadTool(listBudgetsTool),
  defineReadTool(listGoalsTool),
  defineReadTool(listUpcomingTool),
  defineReadTool(getForecastTool),
];

/** The write tools of §17.4.2 (0.4b), listed only to a token with scope `write`. */
export const writeTools: readonly AnyWriteToolSpec[] = writeToolSpecs;
