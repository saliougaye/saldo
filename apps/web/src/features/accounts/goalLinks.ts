/**
 * The links «Metti da parte», «Preleva» and «Registra la spesa» follow (decision 7): the ordinary
 * new-transaction form, filled by `formView`'s `prefill`. Every value is percent-encoded.
 */
const NEW = '/transactions?new';

/** «Metti da parte» is `parent → goal`, «Preleva» is `goal → parent`; the amount is left to the user. */
export function goalTransferHref(fromId: string, toId: string, description: string): string {
  return `${NEW}&from=${encodeURIComponent(fromId)}&to=${encodeURIComponent(toId)}&description=${encodeURIComponent(description)}`;
}

/** «Registra la spesa»: an expense from the goal for its whole balance; saving it closes the goal. */
export function goalExpenseHref(goalId: string, amount: number, description: string): string {
  return `${NEW}&closeGoal=${encodeURIComponent(goalId)}&amount=${encodeURIComponent(String(amount))}&description=${encodeURIComponent(description)}`;
}

/** A goal's form, in Profilo → Obiettivi (§17.1.7): where Conti's «Modifica» goes. */
export function goalEditHref(goalId: string): string {
  return `/profile/goals?g=${encodeURIComponent(goalId)}`;
}

/** A goal's detail in Conti: movements, «Metti da parte», «Preleva» and «Chiudi» live there. */
export function goalAccountsHref(goalId: string): string {
  return `/accounts?g=${encodeURIComponent(goalId)}`;
}

/** «Nuovo obiettivo» in Profilo → Obiettivi. */
export const NEW_GOAL_HREF = '/profile/goals?new';
