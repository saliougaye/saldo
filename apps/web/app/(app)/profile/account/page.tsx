import { readPage } from '../../../../src/server/page/context';
import { Section } from '../../../../src/ui/Section';
import { SummaryRow } from '../../../../src/ui/SummaryRow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ProfileAccountPage() {
  const page = await readPage(Promise.resolve({}));
  const { t } = page;
  return (
    <Section open title={t('profile.title')}>
      <SummaryRow title={t('web.auth.nameLabel')} value={page.user.displayName} />
      <SummaryRow title={t('web.auth.emailLabel')} value={page.user.email} />
    </Section>
  );
}
