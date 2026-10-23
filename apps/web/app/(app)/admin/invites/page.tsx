import { plural } from '@saldo/i18n/translate';
import { Fragment } from 'react';
import { adminErrorStrings } from '../../../../src/features/admin/errorStrings';
import {
  inviteRows,
  inviteStatusKey,
  usedByAddress,
} from '../../../../src/features/admin/invitesView';
import { resolveMessage } from '../../../../src/features/admin/resolveMessage';
import { INVITE_TTL_CHOICES } from '../../../../src/server/admin/invites';
import { requireWebAdmin } from '../../../../src/server/auth/currentUser';
import { listInvites, MAX_INVITE_LABEL_LENGTH } from '../../../../src/server/auth/invites';
import { getDb } from '../../../../src/server/db/client';
import { adminContext } from '../../../../src/server/page/adminContext';
import { EmptyState } from '../../../../src/ui/EmptyState';
import { Icon } from '../../../../src/ui/Icon';
import { PanelLink } from '../../../../src/ui/PanelNav';
import { type PanelSpec, PanelSwitch } from '../../../../src/ui/PanelSwitch';
import { Section } from '../../../../src/ui/Section';
import { SummaryRow } from '../../../../src/ui/SummaryRow';
import styles from '../admin.module.css';
import { MintInvite } from './MintInvite';
import { RevokeInvite, RevokeInviteShared } from './RevokeInvite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/admin/invites';
const DEFAULT_TTL_DAYS = 7;

/** `?new` opens «Nuovo invito» and wins over `?i={id}`. An id that names no invite opens nothing. */
const PANEL_PARAMS = { flags: ['new'], values: ['i'] } as const;

/**
 * Admin → Inviti (§17.1.7): newest first. `?new` opens «Nuovo invito», `?i={id}` an invite's panel,
 * in place (`PanelSwitch`). The page renders the panel of every invite: the label, the dates, the
 * status and who used it. The code is never on this page, open or closed: the database keeps only
 * its hash, and the code exists only in the answer of the mint, in `MintInvite`'s state.
 */
export default async function AdminInvitesPage() {
  const admin = await requireWebAdmin();
  const [ctx, invites] = await Promise.all([adminContext(admin), listInvites(getDb(), new Date())]);
  const { t, locale } = ctx;
  const rows = inviteRows(invites);
  const errors = adminErrorStrings(t);
  const say = (message: Parameters<typeof resolveMessage>[0], style: 'long' | 'short') =>
    resolveMessage(message, { t, locale, formatDate: ctx.formatDate[style] });
  const newLink = (
    <PanelLink className={styles.newLink} href={`${PATH}?new`}>
      <Icon name="plus" size={16} />
      {t('admin.invites.new')}
    </PanelLink>
  );

  // The form of «Nuovo invito»: in its panel, and — with no invite yet — in the page (W11).
  const mintForm = (inline: boolean) => (
    <MintInvite
      closeHref={PATH}
      doneHref={PATH}
      maxLabelLength={MAX_INVITE_LABEL_LENGTH}
      defaultTtl={String(DEFAULT_TTL_DAYS)}
      inline={inline}
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
  );

  // Every panel the page can open, rendered here: a click only chooses one (`PanelSwitch`).
  const panels: Record<string, PanelSpec> = {
    new: {
      title: t('admin.invites.new'),
      form: true,
      body: mintForm(false),
    },
    ...Object.fromEntries(
      invites.map((invite): [string, PanelSpec] => {
        const label = invite.label ?? t('admin.invites.noLabel');
        return [
          `i:${invite.id}`,
          {
            title: label,
            form: true,
            body: (
              <>
                <div className={styles.who}>
                  <span className={styles.tileBig} aria-hidden="true">
                    <Icon name="key" size={20} />
                  </span>
                  <div className={styles.whoText}>
                    <p className={styles.whoName}>{label}</p>
                    <p className={styles.whoSub}>{t(inviteStatusKey(invite.status))}</p>
                  </div>
                </div>
                <dl className={styles.facts}>
                  <dt>{t('admin.invites.created')}</dt>
                  <dd>
                    {invite.createdByName === null
                      ? t('admin.invites.createdByCli', {
                          date: ctx.formatDate.long(invite.createdAt),
                        })
                      : t('admin.invites.createdBy', {
                          date: ctx.formatDate.long(invite.createdAt),
                          name: invite.createdByName,
                        })}
                  </dd>
                  <dt>{t('admin.invites.expires')}</dt>
                  <dd>{ctx.formatDate.long(invite.expiresAt)}</dd>
                  {invite.status === 'used' ? (
                    <Fragment>
                      <dt>{t('admin.invites.usedBy')}</dt>
                      <dd>{usedByAddress(invite) ?? t('admin.invites.usedByUnknown')}</dd>
                    </Fragment>
                  ) : null}
                  {invite.status === 'revoked' && invite.revokedAt !== null ? (
                    <Fragment>
                      <dt>{t('admin.invites.revokedAt')}</dt>
                      <dd>{ctx.formatDate.long(invite.revokedAt)}</dd>
                    </Fragment>
                  ) : null}
                  <dt>{t('admin.invites.code')}</dt>
                  <dd className={styles.factMuted}>{t('admin.invites.codeGone')}</dd>
                </dl>
                {invite.status === 'active' ? (
                  <>
                    <p className={styles.warn}>{t('admin.invites.lostHint')}</p>
                    <div className={styles.actions}>
                      <RevokeInvite
                        id={invite.id}
                        title={t('admin.invites.revokeTitle', { label })}
                      />
                      <span className={styles.spacer} />
                      {newLink}
                    </div>
                  </>
                ) : null}
              </>
            ),
          },
        ];
      }),
    ),
  };

  return (
    <RevokeInviteShared
      value={{
        strings: {
          action: t('admin.invites.revoke'),
          body: t('admin.invites.revokeBody'),
          cancel: t('common.cancel'),
          busy: t('common.loading'),
          errors,
        },
      }}
    >
      <PanelSwitch
        baseHref={PATH}
        params={PANEL_PARAMS}
        panels={panels}
        closeLabel={t('common.close')}
        slot
      >
        <Section open title={t('admin.nav.invites')} trailing={newLink}>
          <p className={styles.note}>{t('admin.invites.note')}</p>
          {rows.length === 0 ? (
            <>
              <EmptyState title={t('admin.invites.empty')} body={t('admin.invites.emptyBody')} />
              <div className={styles.first}>
                <h3 className={styles.firstTitle}>{t('admin.invites.createFirst')}</h3>
                {mintForm(true)}
              </div>
            </>
          ) : (
            <div>
              {rows.map((row) => (
                <div key={row.id} className={row.muted ? styles.muted : undefined}>
                  <SummaryRow
                    href={`${PATH}?i=${encodeURIComponent(row.id)}`}
                    selectId={`i:${row.id}`}
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
      </PanelSwitch>
    </RevokeInviteShared>
  );
}
