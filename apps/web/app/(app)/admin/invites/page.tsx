import { plural } from '@saldo/i18n/translate';
import { Fragment } from 'react';
import { adminErrorStrings } from '../../../../src/features/admin/errorStrings';
import { invitePanel, inviteRows, usedByAddress } from '../../../../src/features/admin/invitesView';
import { resolveMessage } from '../../../../src/features/admin/resolveMessage';
import { INVITE_TTL_CHOICES } from '../../../../src/server/admin/invites';
import { requireWebAdmin } from '../../../../src/server/auth/currentUser';
import { listInvites, MAX_INVITE_LABEL_LENGTH } from '../../../../src/server/auth/invites';
import { getDb } from '../../../../src/server/db/client';
import { adminContext } from '../../../../src/server/page/adminContext';
import { AppLink as Link } from '../../../../src/ui/AppLink';
import { EmptyState } from '../../../../src/ui/EmptyState';
import { Icon } from '../../../../src/ui/Icon';
import { Section } from '../../../../src/ui/Section';
import { SlotPanel } from '../../../../src/ui/SlotPanel';
import { SummaryRow } from '../../../../src/ui/SummaryRow';
import styles from '../admin.module.css';
import { MintInvite } from './MintInvite';
import { RevokeInvite } from './RevokeInvite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/admin/invites';
const DEFAULT_TTL_DAYS = 7;

/**
 * Admin → Inviti (§17.1.7): newest first. `?new` opens «Nuovo invito» (and wins), `?i={id}` an
 * invite's panel. The code is never on this page: it exists only in the form's answer.
 */
export default async function AdminInvitesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireWebAdmin();
  const [ctx, invites, params] = await Promise.all([
    adminContext(admin),
    listInvites(getDb(), new Date()),
    searchParams,
  ]);
  const { t, locale } = ctx;
  const rows = inviteRows(invites);
  const panel = invitePanel(params, invites);
  const errors = adminErrorStrings(t);
  const say = (message: Parameters<typeof resolveMessage>[0], style: 'long' | 'short') =>
    resolveMessage(message, { t, locale, formatDate: ctx.formatDate[style] });
  const shown = panel?.kind === 'invite' ? panel.invite : null;
  const shownRow = rows.find((row) => row.id === shown?.id);

  return (
    <>
      <Section
        open
        title={t('admin.nav.invites')}
        trailing={
          <Link className={styles.newLink} href={`${PATH}?new`}>
            <Icon name="plus" size={16} />
            {t('admin.invites.new')}
          </Link>
        }
      >
        <p className={styles.note}>{t('admin.invites.note')}</p>
        {rows.length === 0 ? (
          <EmptyState title={t('admin.invites.empty')} body={t('admin.invites.emptyBody')} />
        ) : (
          <div>
            {rows.map((row) => (
              <div key={row.id} className={row.muted ? styles.muted : undefined}>
                <SummaryRow
                  href={`${PATH}?i=${encodeURIComponent(row.id)}`}
                  selected={shown?.id === row.id && panel?.kind === 'invite'}
                  leading={
                    <span className={styles.tile} aria-hidden="true">
                      <Icon name="key" size={16} />
                    </span>
                  }
                  title={row.label ?? t('admin.invites.noLabel')}
                  subtitle={say(row.subtitle, 'short')}
                  value={t(row.statusKey)}
                />
              </div>
            ))}
          </div>
        )}
      </Section>

      {panel?.kind === 'new' ? (
        <SlotPanel
          key="panel"
          sheet
          title={t('admin.invites.new')}
          closeHref={PATH}
          closeLabel={t('common.close')}
        >
          <MintInvite
            closeHref={PATH}
            doneHref={PATH}
            maxLabelLength={MAX_INVITE_LABEL_LENGTH}
            defaultTtl={String(DEFAULT_TTL_DAYS)}
            ttlOptions={INVITE_TTL_CHOICES.map((days) => ({
              value: String(days),
              label: plural(t, locale, 'admin.invites.ttlDays', days),
            }))}
            strings={{
              newTitle: t('admin.invites.new'),
              label: t('admin.invites.label'),
              labelHint: t('admin.invites.labelHint'),
              ttl: t('admin.invites.ttl'),
              create: t('admin.invites.create'),
              cancel: t('common.cancel'),
              busy: t('common.loading'),
              keyboardHint: t('web.form.keyboardHint'),
              mintedTitle: t('admin.invites.mintedTitle', { label: '{{label}}' }),
              copyNow: t('admin.invites.copyNow'),
              copyNowBody: t('admin.invites.copyNowBody'),
              copyCode: t('admin.invites.copyCode'),
              copyLink: t('admin.invites.copyLink'),
              copied: t('admin.invites.copied'),
              qrLabel: t('admin.invites.qrLabel'),
              qrCaption: t('admin.invites.qrCaption'),
              expiresOn: t('admin.invites.expiresOn', { date: '{{date}}' }),
              done: t('admin.invites.done'),
              errors,
            }}
          />
        </SlotPanel>
      ) : shown !== null && shownRow !== undefined ? (
        <SlotPanel
          key="panel"
          sheet
          title={shown.label ?? t('admin.invites.noLabel')}
          closeHref={PATH}
          closeLabel={t('common.close')}
        >
          <div className={styles.who}>
            <span className={styles.tileBig} aria-hidden="true">
              <Icon name="key" size={20} />
            </span>
            <div className={styles.whoText}>
              <p className={styles.whoName}>{shown.label ?? t('admin.invites.noLabel')}</p>
              <p className={styles.whoSub}>{t(shownRow.statusKey)}</p>
            </div>
          </div>
          <dl className={styles.facts}>
            <dt>{t('admin.invites.created')}</dt>
            <dd>
              {shown.createdByName === null
                ? t('admin.invites.createdByCli', { date: ctx.formatDate.long(shown.createdAt) })
                : t('admin.invites.createdBy', {
                    date: ctx.formatDate.long(shown.createdAt),
                    name: shown.createdByName,
                  })}
            </dd>
            <dt>{t('admin.invites.expires')}</dt>
            <dd>{ctx.formatDate.long(shown.expiresAt)}</dd>
            {shown.status === 'used' ? (
              <Fragment>
                <dt>{t('admin.invites.usedBy')}</dt>
                <dd>{usedByAddress(shown) ?? t('admin.invites.usedByUnknown')}</dd>
              </Fragment>
            ) : null}
            {shown.status === 'revoked' && shown.revokedAt !== null ? (
              <Fragment>
                <dt>{t('admin.invites.revokedAt')}</dt>
                <dd>{ctx.formatDate.long(shown.revokedAt)}</dd>
              </Fragment>
            ) : null}
            <dt>{t('admin.invites.code')}</dt>
            <dd className={styles.factMuted}>{t('admin.invites.codeGone')}</dd>
          </dl>
          {shown.status === 'active' ? (
            <>
              <p className={styles.warn}>{t('admin.invites.lostHint')}</p>
              <div className={styles.actions}>
                <RevokeInvite
                  key={shown.id}
                  id={shown.id}
                  strings={{
                    action: t('admin.invites.revoke'),
                    title: t('admin.invites.revokeTitle', {
                      label: shown.label ?? t('admin.invites.noLabel'),
                    }),
                    body: t('admin.invites.revokeBody'),
                    cancel: t('common.cancel'),
                    busy: t('common.loading'),
                    errors,
                  }}
                />
                <span className={styles.spacer} />
                <Link className={styles.newLink} href={`${PATH}?new`}>
                  <Icon name="plus" size={16} />
                  {t('admin.invites.new')}
                </Link>
              </div>
            </>
          ) : null}
        </SlotPanel>
      ) : null}
    </>
  );
}
