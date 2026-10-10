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
import { isAdmin } from '../../../../src/server/auth/admin';
import { getDb } from '../../../../src/server/db/client';
import { env } from '../../../../src/server/env';
import { listConnectors } from '../../../../src/server/mcp/connectors';
import { readPage } from '../../../../src/server/page/context';
import { pageMcpSetting } from '../../../../src/server/page/instanceSettings';
import { Alert } from '../../../../src/ui/Alert';
import { AppLink as Link } from '../../../../src/ui/AppLink';
import { EmptyState } from '../../../../src/ui/EmptyState';
import { Icon } from '../../../../src/ui/Icon';
import { Section } from '../../../../src/ui/Section';
import { SlotPanel } from '../../../../src/ui/SlotPanel';
import { ConnectPanel } from './ConnectPanel';
import styles from './connectors.module.css';
import { RevokeConnector } from './RevokeConnector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OFF_BODY = {
  off: 'web.connectors.offBody',
  offAdmin: 'web.connectors.offAdminBody',
  offAdminEnv: 'web.connectors.offAdminEnvBody',
} as const;

/**
 * Profilo › Connettori (§17.4.3, «★ Scelta»): «Collega» on top — or, while MCP is off, the notice
 * that replaces it — and «Autorizzati» under it, one row per consent, `?connector={clientId}` opening the
 * passkeys' trailing panel with the facts and «Revoca accesso». The rows stay while MCP is off, so
 * revoking still works.
 */
export default async function ConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await readPage(searchParams);
  const { t, locale, timeZone, user } = page;
  const now = new Date();
  const [connectors, mcp, admin] = await Promise.all([
    listConnectors(user.id),
    pageMcpSetting(),
    isAdmin(getDb(), user.id),
  ]);
  const rows = connectorRows(connectors, page.params[CONNECTOR_PARAM] ?? null, now, timeZone);
  const selected = rows.find((row) => row.selected) ?? null;
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

  return (
    <>
      <Section open title={t('web.connectors.connectTitle')}>
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
      </Section>

      <Section
        open
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
                <Link
                  key={row.clientId}
                  className={`${styles.row} ${row.selected ? styles.selected : ''}`}
                  href={row.href}
                  aria-current={row.selected ? 'true' : undefined}
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
                </Link>
              ))}
            </div>
          )}
          <p className={styles.hint}>{t('web.connectors.revokeNote')}</p>
        </div>
      </Section>

      {selected === null ? null : (
        <SlotPanel
          key="panel"
          bare
          title={selected.name}
          closeHref={CONNECTORS_PATH}
          closeLabel={t('common.close')}
        >
          <div className={styles.panelHead}>
            <span className={`${styles.tile} ${styles.tileLarge}`} aria-hidden="true">
              {selected.initial}
            </span>
            <span className={styles.panelName}>{selected.name}</span>
          </div>
          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>{t('web.connectors.factScopes')}</dt>
              <dd className={styles.factValue}>{scopeChips(selected.scopes)}</dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>{t('web.connectors.factReturnsTo')}</dt>
              <dd className={styles.factValue}>
                <code className={styles.code}>{selected.redirectHost}</code>
              </dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>{t('web.connectors.factAuthorized')}</dt>
              <dd className={styles.factValue}>{long(selected.authorizedIso)}</dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>{t('web.connectors.factLastUsed')}</dt>
              <dd className={styles.factValue}>{used(selected.lastUsed, 'fact')}</dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>{t('web.connectors.factCalls')}</dt>
              <dd className={styles.factValue}>
                {plural(t, locale, 'web.connectors.calls', selected.calls, {
                  date: long(selected.authorizedIso),
                })}
              </dd>
            </div>
          </dl>
          <p className={styles.hint}>{t('web.connectors.panelNote')}</p>
          <RevokeConnector
            key={selected.clientId}
            clientId={selected.clientId}
            closeHref={CONNECTORS_PATH}
            strings={{
              revoke: t('web.connectors.revoke'),
              title: t('web.connectors.revokeTitle', { name: selected.name }),
              body: t('web.connectors.revokeBody'),
              confirm: t('web.connectors.revokeConfirm'),
              cancel: t('common.cancel'),
              busy: t('common.loading'),
              failed: t('web.connectors.revokeFailed'),
            }}
          />
        </SlotPanel>
      )}
    </>
  );
}
