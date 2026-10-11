import { formatCycleRange } from '@saldo/i18n';
import { readPage } from '../../../../src/server/page/context';
import { Icon } from '../../../../src/ui/Icon';
import { Section } from '../../../../src/ui/Section';
import { SummaryRow } from '../../../../src/ui/SummaryRow';
import styles from './data.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Profilo → Dati (§11, §17.1.7): the phone's exports as three files to save. Each row is a plain
 * download link to a route handler, so the download needs no client code and the browser names the
 * file.
 * Everything that replaces or deletes data — restore, CSV import, «Elimina tutti i dati» — and the
 * ZIP with the attachments' bytes stay on the phone, and the page says so.
 */
export default async function ProfileDataPage() {
  const page = await readPage(Promise.resolve({}));
  const { t, locale, today, period } = page;
  const save = <Icon name="arrowDL" size={18} className={styles.save} />;
  return (
    <Section open title={t('io.exportSection')}>
      <SummaryRow
        download
        href="/api/export/backup"
        title={t('io.backupJson')}
        subtitle={t('io.backupJsonHint')}
        trailing={save}
      />
      <SummaryRow
        download
        href="/api/export/csv?range=all"
        title={t('io.csvAll')}
        subtitle={t('web.data.csvAllHint')}
        trailing={save}
      />
      <SummaryRow
        download
        href="/api/export/csv?range=period"
        title={t('io.csvPeriod')}
        subtitle={t('web.data.csvPeriodHint', {
          range: formatCycleRange(period.range, locale, today),
        })}
        trailing={save}
      />
      <p className={styles.note}>
        {t('web.data.phoneNote', { deleteAll: t('profile.deleteAllData') })}
      </p>
    </Section>
  );
}
