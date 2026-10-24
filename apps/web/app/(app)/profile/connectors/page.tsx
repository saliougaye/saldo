import type { ToolScope } from '@saldo/core';
import { plural } from '@saldo/i18n/translate';
import { MCP_ADMIN_PATH } from '../../../../src/features/admin/mcpView';
import { instantFormatter } from '../../../../src/features/admin/resolveMessage';
import {
  CONNECTOR_PARAM,
  CONNECTORS_PATH,
  claudeCodeCommand,
  connectorRows,
  connectorsNotice,
  LAST_USED_KEYS,
  type LastUsed,
  mcpEndpoint,
  mcpRemoteCommand,
  PROTECTED_RESOURCE_PATH,
} from '../../../../src/features/connectors/connectorsView';
import { isAdminUser } from '../../../../src/server/auth/admin';
import { env } from '../../../../src/server/env';
import { listConnectors } from '../../../../src/server/mcp/connectors';
import { readPage } from '../../../../src/server/page/context';
import { pageMcpSetting } from '../../../../src/server/page/instanceSettings';
import { Alert } from '../../../../src/ui/Alert';
import { AppLink as Link } from '../../../../src/ui/AppLink';
import { EmptyState } from '../../../../src/ui/EmptyState';
import { Icon } from '../../../../src/ui/Icon';
import { PanelLink } from '../../../../src/ui/PanelNav';
import { type PanelSpec, PanelSwitch } from '../../../../src/ui/PanelSwitch';
import { SettingsBox, SettingsSection } from '../../../../src/ui/SettingsSection';
import { ConnectPanel } from './ConnectPanel';
import styles from './connectors.module.css';
import { RevokeConnector, RevokeConnectorShared } from './RevokeConnector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** `?connector={clientId}` opens one connector. An id that is not one of the user's opens nothing. */
const PANEL_PARAMS = { flags: [], values: [CONNECTOR_PARAM] } as const;

const OFF_BODY = {
  off: 'web.connectors.offBody',
  offAdmin: 'web.connectors.offAdminBody',
  offAdminEnv: 'web.connectors.offAdminEnvBody',
} as const;

/**
 * Profilo › Connettori (§17.4.3, «★ Scelta»): «Collega» on top — or, while MCP is off, the notice
 * that replaces it — and «Autorizzati» under it, one row per consent, `?connector={clientId}` opening the
 * passkeys' trailing panel with the facts and «Revoca accesso», in place (`PanelSwitch`). The rows
 * stay while MCP is off, so revoking still works.
 */
export default async function ConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await readPage(searchParams);
  const { t, locale, timeZone, user } = page;
  const now = new Date();
  const admin = isAdminUser(user);
  const [connectors, mcp] = await Promise.all([listConnectors(user.id), pageMcpSetting()]);
  const rows = connectorRows(connectors, now, timeZone);
  const notice = connectorsNotice({ enabled: mcp.value, lockedByEnv: mcp.source === 'env', admin });
  const { publicUrl } = env();
  const endpoint = mcpEndpoint(publicUrl);
  const short = instantFormatter({ timeZone, locale, now, style: 'short' });
  const long = instantFormatter({ timeZone, locale, now, style: 'long' });
  const scopeLabels: Record<ToolScope, string> = {
    read: t('web.connectors.scopeRead'),
    write: t('web.connectors.scopeWrite'),
  };

  const used = (value: LastUsed, style: 'row' | 'fact') => {
    if (value.kind === 'on') {
      return style === 'row'
        ? t('web.connectors.usedOn', { date: short(value.iso) })
        : long(value.iso);
    }
    return t(LAST_USED_KEYS[style][value.kind]);
  };

  const scopeChips = (scopes: readonly ToolScope[]) => (
    <span className={styles.chips}>
      {scopes.map((scope) => (
        <span key={scope} className={styles.chip}>
          <Icon name={scope === 'read' ? 'eye' : 'pencil'} size={12} />
          {scopeLabels[scope]}
        </span>
      ))}
    </span>
  );

  // Every panel the page can open, rendered here: a click only chooses one (`PanelSwitch`). A panel
  // holds the facts that the user's own row already has, the host the client returns to and the count
  // of calls: no token and no secret. «Revoca accesso» stays a navigation.
  const panels: Record<string, PanelSpec> = Object.fromEntries(
    rows.map((row): [string, PanelSpec] => [
      `${CONNECTOR_PARAM}:${row.clientId}`,
      {
        title: row.name,
        bare: true,
        body: (
          <>
            <div className={styles.panelHead}>
              <span className={`${styles.tile} ${styles.tileLarge}`} aria-hidden="true">
                {row.initial}
              </span>
              <span className={styles.panelName}>{row.name}</span>
            </div>
            <dl className={styles.facts}>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>{t('web.connectors.factScopes')}</dt>
                <dd className={styles.factValue}>{scopeChips(row.scopes)}</dd>
              </div>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>{t('web.connectors.factReturnsTo')}</dt>
                <dd className={styles.factValue}>
                  <code className={styles.code}>{row.redirectHost}</code>
                </dd>
              </div>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>{t('web.connectors.factAuthorized')}</dt>
                <dd className={styles.factValue}>{long(row.authorizedIso)}</dd>
              </div>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>{t('web.connectors.factLastUsed')}</dt>
                <dd className={styles.factValue}>{used(row.lastUsed, 'fact')}</dd>
              </div>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>{t('web.connectors.factCalls')}</dt>
                <dd className={styles.factValue}>
                  {plural(t, locale, 'web.connectors.calls', row.calls, {
                    date: long(row.authorizedIso),
                  })}
                </dd>
              </div>
            </dl>
            <p className={styles.hint}>{t('web.connectors.panelNote')}</p>
            <RevokeConnector
              clientId={row.clientId}
              title={t('web.connectors.revokeTitle', { name: row.name })}
            />
          </>
        ),
      },
    ]),
  );

  return (
    <RevokeConnectorShared
      value={{
        closeHref: CONNECTORS_PATH,
        strings: {
          revoke: t('web.connectors.revoke'),
          body: t('web.connectors.revokeBody'),
          confirm: t('web.connectors.revokeConfirm'),
          cancel: t('common.cancel'),
          busy: t('common.loading'),
          failed: t('web.connectors.revokeFailed'),
        },
      }}
    >
      <PanelSwitch
        baseHref={CONNECTORS_PATH}
        params={PANEL_PARAMS}
        panels={panels}
        closeLabel={t('common.close')}
        slot
      >
        <SettingsSection title={t('web.connectors.title')}>
          <SettingsBox title={t('web.connectors.connectTitle')}>
            <div className={styles.stack}>
              {notice === null ? (
                <ConnectPanel
                  endpoint={endpoint}
                  claudeCode={claudeCodeCommand(endpoint)}
                  mcpRemote={mcpRemoteCommand(endpoint)}
                  discoveryUrl={`${publicUrl}${PROTECTED_RESOURCE_PATH}`}
                  strings={{
                    body: t('web.connectors.connectBody'),
                    copy: t('web.connectors.copy'),
                    copied: t('web.connectors.copied'),
                    clients: t('web.connectors.clientsLabel'),
                    tabClaudeCode: t('web.connectors.tabClaudeCode'),
                    tabClaude: t('web.connectors.tabClaude'),
                    tabOther: t('web.connectors.tabOther'),
                    claudeCodeHint: t('web.connectors.claudeCodeHint'),
                    claudeStep1: t('web.connectors.claudeStep1'),
                    claudeStep2: t('web.connectors.claudeStep2'),
                    otherBody: t('web.connectors.otherBody'),
                    otherTerminal: t('web.connectors.otherTerminal'),
                  }}
                />
              ) : (
                <Alert quiet title={t('web.connectors.offTitle')} body={t(OFF_BODY[notice])}>
                  {notice === 'off' ? undefined : (
                    <Link className={styles.link} href={MCP_ADMIN_PATH}>
                      {t('web.connectors.offAdminLink')}
                    </Link>
                  )}
                </Alert>
              )}
            </div>
          </SettingsBox>

          <SettingsBox
            title={t('web.connectors.authorizedTitle')}
            trailing={rows.length === 0 ? undefined : rows.length}
          >
            <div className={styles.stack}>
              {rows.length === 0 ? (
                <EmptyState
                  title={t('web.connectors.emptyTitle')}
                  body={t('web.connectors.emptyBody')}
                />
              ) : (
                <div className={styles.rows}>
                  {rows.map((row) => (
                    <PanelLink
                      key={row.clientId}
                      className={styles.row}
                      selectedClassName={styles.selected}
                      selectId={`${CONNECTOR_PARAM}:${row.clientId}`}
                      href={row.href}
                    >
                      <span className={styles.tile} aria-hidden="true">
                        {row.initial}
                      </span>
                      <span className={styles.text}>
                        <span className={styles.name}>{row.name}</span>
                        <span className={styles.meta}>
                          {scopeChips(row.scopes)}
                          <span>
                            {t('web.connectors.authorizedOn', { date: short(row.authorizedIso) })} ·{' '}
                            {used(row.lastUsed, 'row')}
                          </span>
                        </span>
                      </span>
                      <Icon name="chevR" size={16} className={styles.chevron} />
                    </PanelLink>
                  ))}
                </div>
              )}
              <p className={styles.hint}>{t('web.connectors.revokeNote')}</p>
            </div>
          </SettingsBox>
        </SettingsSection>
      </PanelSwitch>
    </RevokeConnectorShared>
  );
}
