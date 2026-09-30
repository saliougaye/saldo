import { readPage } from '../../../../src/server/page/context';
import { Section } from '../../../../src/ui/Section';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Placeholder until the section is built (0.3e-2b). */
export default async function ProfileCategoriesPage() {
  const { t } = await readPage(Promise.resolve({}));
  return (
    <Section open title={t('categories.title')}>
      {null}
    </Section>
  );
}
