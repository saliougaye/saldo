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
