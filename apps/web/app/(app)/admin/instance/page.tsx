import { SYNC_SCHEMA_VERSION } from '@saldo/core';
import type { IconName } from '@saldo/ui';
import { instanceRows } from '../../../../src/features/admin/instanceView';
import { resolveMessage } from '../../../../src/features/admin/resolveMessage';
import { requireWebAdmin } from '../../../../src/server/auth/currentUser';
import { env } from '../../../../src/server/env';
import { adminContext } from '../../../../src/server/page/adminContext';
import { API_VERSION, APP_VERSION } from '../../../../src/server/version';
import { Icon } from '../../../../src/ui/Icon';
import { SettingsBox, SettingsSection } from '../../../../src/ui/SettingsSection';
import { SummaryRow } from '../../../../src/ui/SummaryRow';
import styles from '../admin.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ICONS: Record<string, IconName> = {
  version: 'info',
  sync: 'repeat',
  storage: 'archive',
  address: 'wifi',
  timeZone: 'clock',
};

/** Admin → Istanza (§17.1.7): what the server is, read from the environment and the build. No panel. */
export default async function AdminInstancePage() {
  const admin = await requireWebAdmin();
  const ctx = await adminContext(admin);
  const { t, locale } = ctx;
  const { attachmentStorage, publicUrl, defaultTimeZone } = env();
  const rows = instanceRows({
    version: APP_VERSION,
    apiVersion: API_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    storageKind: attachmentStorage.kind,
    publicUrl,
    defaultTimeZone,
  });
  const say = (message: Parameters<typeof resolveMessage>[0]) =>
    resolveMessage(message, { t, locale, formatDate: ctx.formatDate.long });
  return (
    <SettingsSection title={t('admin.nav.instance')} trailing={t('admin.instance.trailing')}>
      <SettingsBox>
        <div>
          {rows.map((row) => (
            <SummaryRow
              key={row.id}
              leading={
                <span className={styles.tile} aria-hidden="true">
                  <Icon name={ICONS[row.id] ?? 'info'} size={16} />
                </span>
              }
              title={t(row.labelKey)}
              subtitle={row.subtitle === null ? undefined : say(row.subtitle)}
              value={say(row.value)}
            />
          ))}
        </div>
      </SettingsBox>
    </SettingsSection>
  );
}
