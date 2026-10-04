import { type AnyWriteToolHandler, defineWriteToolHandler } from './types';
import { accountHandlers } from './write/accounts';
import { budgetHandlers } from './write/budgets';
import { categoryHandlers } from './write/categories';
import { goalHandlers } from './write/goals';
import type { Clock } from './write/shared';
import { tagHandlers } from './write/tags';
import { transactionHandlers } from './write/transactions';

/**
 * §17.4.2: the write handlers the route registers for a token with scope `write`, in the
 * catalogue's order (`writeTools` in `@saldo/core`). Each maps its input onto the server's write
 * functions (`src/server/write/*`) — the web's own — and answers a refusal as a readable message.
 */
export function createWriteToolHandlers(
  clock: Clock = () => new Date(),
): readonly AnyWriteToolHandler[] {
  const handlers = {
    ...transactionHandlers(clock),
    ...accountHandlers(clock),
    ...categoryHandlers(clock),
    ...tagHandlers(clock),
    ...budgetHandlers(clock),
    ...goalHandlers(clock),
  };
  return [
    defineWriteToolHandler(handlers.saveTransaction),
    defineWriteToolHandler(handlers.deleteTransaction),
    defineWriteToolHandler(handlers.saveAccount),
    defineWriteToolHandler(handlers.archiveAccount),
    defineWriteToolHandler(handlers.saveCategory),
    defineWriteToolHandler(handlers.archiveCategory),
    defineWriteToolHandler(handlers.saveTag),
    defineWriteToolHandler(handlers.mergeTags),
    defineWriteToolHandler(handlers.deleteTag),
    defineWriteToolHandler(handlers.saveBudget),
    defineWriteToolHandler(handlers.deleteBudget),
    defineWriteToolHandler(handlers.saveGoal),
    defineWriteToolHandler(handlers.moveGoalMoney),
    defineWriteToolHandler(handlers.closeGoal),
  ];
}

export const writeToolHandlers: readonly AnyWriteToolHandler[] = createWriteToolHandlers();
