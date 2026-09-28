import { redirect } from 'next/navigation';
import { currentUser } from '../src/server/auth/currentUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * §17.1.1: the instance's root **is** the app. The landing page it used to show is gone; the version
 * and the host live at the foot of `/login` instead.
 */
export default async function RootPage() {
  redirect((await currentUser()) === null ? '/login' : '/home');
}
