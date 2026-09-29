import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** §17.1.7: Profilo is its sections; the bare path opens the first one. */
export default function ProfileIndex() {
  redirect('/profile/account');
}
