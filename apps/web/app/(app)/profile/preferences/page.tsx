import { preferenceRows } from '../../../../src/features/profile/profileRows';
import { readPage } from '../../../../src/server/page/context';
import { EmptyState } from '../../../../src/ui/EmptyState';
import { ListRow } from '../../../../src/ui/ListRow';
import { Section } from '../../../../src/ui/Section';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ProfilePreferencesPage() {
  const page = await readPage(Promise.resolve({}));
  const { t, locale, settings } = page;
  const rows = preferenceRows(settings, locale);
  return (
    <Section title={t('settings.preferences')}>
      {rows.map((row) => (
        <ListRow
          key={row.key}
          title={t(row.labelKey)}
          trailing={
            row.key === 'cycle'
              ? t('settings.cycleValue', { day: row.value })
              : row.key === 'theme'
                ? t(`profile.${row.value}`)
                : row.value === ''
                  ? t('profile.system')
                  : row.value
          }
        />
      ))}
      <EmptyState title={t('settings.appliesToPhone')} body={t('web.shell.comingIn0_3e')} />
    </Section>
  );
}
