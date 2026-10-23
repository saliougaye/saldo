import { type GoalFormValues, type MinorDigits, minorToAmountBuffer } from '@saldo/core';

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

/** A goal preset of the empty states (W11): the new goal form with a name, and a target when it has one. */
export interface GoalPreset {
  key: 'emergency' | 'holiday' | 'car';
  name: string;
  /** Minor units; null for a preset with no figure of its own. */
  amount: number | null;
  href: string;
}

/** The three presets: the emergency fund has a target, holiday and car have none. */
export function goalPresets(input: {
  /** The names of emergency fund, holiday and car, in that order. */
  names: readonly [string, string, string];
  emergency: number | null;
}): GoalPreset[] {
  const [emergency, holiday, car] = input.names;
  const presets: { key: GoalPreset['key']; name: string; amount: number | null }[] = [
    { key: 'emergency', name: emergency, amount: input.emergency },
    { key: 'holiday', name: holiday, amount: null },
    { key: 'car', name: car, amount: null },
  ];
  return presets.map((preset) => ({
    ...preset,
    href: `${NEW_GOAL_HREF}&name=${encodeURIComponent(preset.name)}${
      preset.amount === null || preset.amount <= 0 ? '' : `&target=${preset.amount}`
    }`,
  }));
}

/** The longest account or goal name (`entities.ts`). */
const NAME_MAX = 60;

/**
 * What a preset's link puts in the new goal form. The URL is user input: the name is cut to its
 * limit, and the target must be a whole number of minor units above zero, else it is dropped.
 */
export function goalPrefillFrom(
  params: { name?: string; target?: string },
  minorDigits: MinorDigits,
): Partial<GoalFormValues> | undefined {
  const name = params.name?.trim().slice(0, NAME_MAX) ?? '';
  const target =
    params.target !== undefined && /^[1-9]\d{0,14}$/.test(params.target)
      ? minorToAmountBuffer(Number(params.target), minorDigits)
      : '';
  if (name === '' && target === '') return undefined;
  return { ...(name === '' ? {} : { name }), ...(target === '' ? {} : { buffer: target }) };
}
