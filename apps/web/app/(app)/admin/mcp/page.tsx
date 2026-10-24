import { plural } from '@saldo/i18n/translate';
import { settingsErrorStrings } from '../../../../src/features/admin/errorStrings';
import {
  insecurePublicUrl,
  lockedVariable,
  offWarning,
} from '../../../../src/features/admin/mcpView';
import {
  AUTHORIZATION_SERVER_PATH,
  mcpEndpoint,
  PROTECTED_RESOURCE_PATH,
} from '../../../../src/features/connectors/connectorsView';
import { requireWebAdmin } from '../../../../src/server/auth/currentUser';
import { getDb } from '../../../../src/server/db/client';
import { env } from '../../../../src/server/env';
import { mcpAdminStats } from '../../../../src/server/mcp/connectors';
import { adminContext } from '../../../../src/server/page/adminContext';
import { readServerSettings } from '../../../../src/server/settings/serverSettings';
import { Alert } from '../../../../src/ui/Alert';
import { CopyField } from '../../../../src/ui/CopyField';
import { Icon } from '../../../../src/ui/Icon';
import { SettingsBox, SettingsSection } from '../../../../src/ui/SettingsSection';
import { McpSwitch } from './McpSwitch';
import styles from './mcp.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin › MCP (§17.4.3, variant C): the switch, three aggregate numbers — no client names, no
 * user's detail — and what to give a client. `MCP_ENABLED` locks the switch and the page says so.
 */
export default async function AdminMcpPage() {
  const admin = await requireWebAdmin();
  const db = getDb();
  const [ctx, settings, stats] = await Promise.all([
    adminContext(admin),
    readServerSettings(db),
    mcpAdminStats(new Date()),
  ]);
  const { t, locale } = ctx;
  const setting = settings.mcpEnabled;
  const lock = lockedVariable(setting);
  const warning = offWarning(stats);
  const offBody =
    warning.kind === 'none'
      ? t('admin.mcp.offNone')
      : plural(t, locale, 'admin.mcp.offBody', warning.users, {
          connectors: plural(t, locale, 'admin.mcp.connectors', warning.connectors),
        });
  const { publicUrl } = env();
  const endpoint = mcpEndpoint(publicUrl);

  return (
    <SettingsSection title={t('admin.mcp.title')}>
      <SettingsBox>
        <div className={styles.stack}>
          {lock === null ? null : (
            <p className={styles.lock}>
              <Icon name="lock" size={16} />
              <span>{t('admin.mcp.locked', { variable: lock })}</span>
            </p>
          )}
          <McpSwitch
            enabled={setting.value}
            locked={lock !== null}
            strings={{
              label: t('admin.mcp.switchLabel'),
              note: t('admin.mcp.switchNote'),
              offTitle: t('admin.mcp.offTitle'),
              offBody,
              cancel: t('common.cancel'),
              turnOff: t('admin.mcp.turnOff'),
              busy: t('common.loading'),
              errors: settingsErrorStrings(t),
            }}
          />
          <dl className={styles.numbers}>
            <div>
              <dt>{t('admin.mcp.usersWithConnectors')}</dt>
              <dd>
                {stats.usersWithConnectors}
                <small>{t('admin.mcp.outOf', { total: stats.totalUsers })}</small>
              </dd>
            </div>
            <div>
              <dt>{t('admin.mcp.connectorsAuthorized')}</dt>
              <dd>{stats.connectorsAuthorized}</dd>
            </div>
            <div>
              <dt>{t('admin.mcp.connectorsUsed')}</dt>
              <dd>{stats.connectorsUsedLast7Days}</dd>
            </div>
          </dl>
          <h3 className={styles.subTitle}>{t('admin.mcp.clientTitle')}</h3>
          <CopyField
            value={endpoint}
            copyLabel={t('web.connectors.copy')}
            copiedLabel={t('web.connectors.copied')}
          />
          <p className={styles.hint}>{t('admin.mcp.discovery')}</p>
          <ul className={styles.paths}>
            <li>
              <code>{PROTECTED_RESOURCE_PATH}</code>
            </li>
            <li>
              <code>{AUTHORIZATION_SERVER_PATH}</code>
            </li>
          </ul>
          <p className={styles.hint}>{t('admin.mcp.httpsNote')}</p>
          {insecurePublicUrl(publicUrl) ? (
            <Alert
              quiet
              title={t('admin.mcp.httpTitle')}
              body={t('admin.mcp.httpBody', { url: publicUrl })}
            />
          ) : null}
        </div>
      </SettingsBox>
    </SettingsSection>
  );
}
