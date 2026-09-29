import { preferenceRows } from '../../../../src/features/profile/profileRows';
import { readPage } from '../../../../src/server/page/context';
import { Section } from '../../../../src/ui/Section';
import { SummaryRow } from '../../../../src/ui/SummaryRow';
import styles from '../profile.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ProfilePreferencesPage() {
  const page = await readPage(Promise.resolve({}));
  const { t, locale, settings } = page;
  const rows = preferenceRows(settings, locale);
  return (
    <Section open title={t('settings.preferences')} trailing={t('settings.appliesToPhone')}>
      {rows.map((row) => (
        <SummaryRow
          key={row.key}
          title={t(row.labelKey)}
          value={
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
      <p className={styles.note}>{t('web.shell.comingIn0_3e')}</p>
    </Section>
  );
}
