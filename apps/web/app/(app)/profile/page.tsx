import { AccountSection } from './account/AccountSection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * W10: `/profile` is the first section, «Profile». On a wide screen it shows beside the menu; below
 * 760px the frame shows the menu alone here, as the phone's list of groups (`SubnavLayout`).
 */
export default function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AccountSection path="/profile" searchParams={searchParams} />;
}
