import { redirect } from 'next/navigation';
import { legacyBudgetsTarget } from '../../../src/features/budgets/legacyRedirect';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Budgets moved to Profilo (0.3e-2b); old links and bookmarks keep working. */
export default async function BudgetsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(legacyBudgetsTarget(await searchParams));
}
