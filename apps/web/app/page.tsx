import { redirect } from 'next/navigation';
import { currentUser } from '../src/server/auth/currentUser';
import { pageSetupNeeded } from '../src/server/page/instanceSettings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * §17.1.1: the instance's root **is** the app. The landing page it used to show is gone; the version
 * and the host live at the foot of `/login` instead. 0.3h: an instance with no account yet goes to
 * the first-run wizard first — there is nobody who could sign in.
 */
export default async function RootPage() {
  if (await pageSetupNeeded()) redirect('/setup');
  redirect((await currentUser()) === null ? '/login' : '/home');
}
