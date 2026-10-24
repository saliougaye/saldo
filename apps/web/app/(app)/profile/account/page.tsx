import { AccountSection } from './AccountSection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default function ProfileAccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AccountSection path="/profile/account" searchParams={searchParams} />;
}
