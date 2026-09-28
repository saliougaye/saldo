import { isAdmin } from '../../../../src/server/auth/admin';
import { getDb } from '../../../../src/server/db/client';
import { readPage } from '../../../../src/server/page/context';
import { ListRow } from '../../../../src/ui/ListRow';
import { Section } from '../../../../src/ui/Section';
import { SignOutButton } from '../../../../src/ui/SignOutButton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ProfileAccountPage() {
  const page = await readPage(Promise.resolve({}));
  const admin = await isAdmin(getDb(), page.user.id);
  const { t } = page;
  return (
    <Section title={t('profile.title')}>
      <ListRow title={t('web.auth.nameLabel')} trailing={page.user.displayName} />
      <ListRow title={t('web.auth.emailLabel')} trailing={page.user.email} />
      <ListRow
        title={t('admin.role')}
        trailing={admin ? t('admin.roleAdmin') : t('admin.roleMember')}
      />
      <SignOutButton label={t('sync.signOut')} working={t('common.loading')} />
    </Section>
  );
}
