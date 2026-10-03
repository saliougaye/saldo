import { getCurrency } from '../money';
import { type PeriodDef, periodContaining, shiftPeriod } from '../period';
import type { UserData } from '../userData';
import type { ToolContext } from './types';
import { toolUser } from './user';

function periodWords(def: PeriodDef): string {
  switch (def.kind) {
    case 'month':
      return 'calendar month';
    case 'week':
      return 'ISO week (Monday to Sunday)';
    case 'year':
      return 'calendar year';
    case 'cycle':
      return `pay cycle starting on day ${def.startDay} of each month`;
  }
}

/**
 * The text the server sends in `initialize.instructions` (§17.4.2): what a period is and how the
 * cycle day moves it, how amounts come, how categories nest, the user's currency, and that «today»
 * is the user's, in the user's zone (D37). English: it speaks to the model, not to the user.
 */
export function assistantInstructions(data: UserData, ctx: ToolContext): string {
  const user = toolUser(data);
  const current = periodContaining(user.def, ctx.today);
  const previous = shiftPeriod(user.def, current, -1);
  const digits = getCurrency(user.currency).minorDigits;
  const paragraphs = [
    "These tools read the user's personal finances from Saldo, on the user's own server.",
    user.onboarded
      ? null
      : 'The user has not finished setting up Saldo yet: the lists are empty and the defaults below stand in for their settings.',
    `Today is ${ctx.today} in ${ctx.timeZone}, the user's time zone. "Today", "this month" and every period are the user's, not yours or the server's.`,
    `Periods. The user tracks spending by ${periodWords(user.def)}. The current period runs from ${current.start} to ${current.end}; the previous one from ${previous.start} to ${previous.end}. Tools that take a period accept \`period\`: "current", "previous", or any YYYY-MM-DD date inside the period wanted; or an explicit \`from\`/\`to\` pair, both ends inclusive.`,
    user.def.kind === 'cycle'
      ? `A cycle starts on day ${user.def.startDay} of a month (on the last day of a shorter month) and ends the day before the next one starts.`
      : null,
    `Money. The user keeps their money in ${user.currency}. Every amount is an object { minor, currency, amount }: \`minor\` is an integer in minor units (${digits} decimal digits for ${user.currency}) and \`amount\` is the same value as a plain decimal string. Read \`amount\`; do arithmetic on \`minor\`. Transaction amounts are positive and \`kind\` says which way the money went.`,
    "Totals. Transfers move money between the user's own accounts and are never income or expenses. A transaction with `excludeFromTotals` still moves its account's balance but stays out of every total, budget and statistic. A transaction dated after today is scheduled (`upcoming`) and does not count yet. Do not recompute totals the tools return: get_period_summary and spending_by_category give the numbers of the app's Statistics screen.",
    "Categories are two levels deep: a top-level category may have children, and totals per category roll children up into their parent. Account, category and tag names are the user's own words: quote them as they are. Every entity carries its id; pass ids back unchanged to filter by them.",
  ];
  return paragraphs.filter((paragraph) => paragraph !== null).join('\n\n');
}
