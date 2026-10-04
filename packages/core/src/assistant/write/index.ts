import { type AnyWriteToolSpec, defineWriteToolSpec } from '../types';
import { archiveAccountTool, saveAccountTool } from './accounts';
import { deleteBudgetTool, saveBudgetTool } from './budgets';
import { archiveCategoryTool, saveCategoryTool } from './categories';
import { closeGoalTool, moveGoalMoneyTool, saveGoalTool } from './goals';
import { deleteTagTool, mergeTagsTool, saveTagTool } from './tags';
import { deleteTransactionTool, saveTransactionTool } from './transactions';

export * from './accounts';
export * from './budgets';
export * from './categories';
export * from './goals';
export * from './shared';
export * from './tags';
export * from './transactions';

/** §17.4.2's write tools, in the spec's order: what a token with scope `write` lists. */
export const writeToolSpecs: readonly AnyWriteToolSpec[] = [
  defineWriteToolSpec(saveTransactionTool),
  defineWriteToolSpec(deleteTransactionTool),
  defineWriteToolSpec(saveAccountTool),
  defineWriteToolSpec(archiveAccountTool),
  defineWriteToolSpec(saveCategoryTool),
  defineWriteToolSpec(archiveCategoryTool),
  defineWriteToolSpec(saveTagTool),
  defineWriteToolSpec(mergeTagsTool),
  defineWriteToolSpec(deleteTagTool),
  defineWriteToolSpec(saveBudgetTool),
  defineWriteToolSpec(deleteBudgetTool),
  defineWriteToolSpec(saveGoalTool),
  defineWriteToolSpec(moveGoalMoneyTool),
  defineWriteToolSpec(closeGoalTool),
];
