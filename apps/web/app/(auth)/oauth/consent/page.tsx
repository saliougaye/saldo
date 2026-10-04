import { redirect } from 'next/navigation';
import { clientInitial } from '../../../../src/features/connectors/connectorsView';
import { clientNote, loginRedirect } from '../../../../src/features/consent/consentView';
import { publicI18n, userI18n } from '../../../../src/i18n/server';
import { currentUser } from '../../../../src/server/auth/currentUser';
import { isSyntheticEmail } from '../../../../src/server/auth/email';
import { consentSearchParams, readConsentRequest } from '../../../../src/server/mcp/consent';
import { adminContext } from '../../../../src/server/page/adminContext';
import { pageInstanceInfo, pageMcpSetting } from '../../../../src/server/page/instanceSettings';
import { Brand } from '../../../../src/ui/Brand';
import { initials } from '../../../../src/ui/initials';
import styles from '../../auth.module.css';
import { ConsentForm } from './ConsentForm';
import { ConsentStop } from './ConsentStop';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * `/oauth/consent` (§17.4.1, §17.4.3 variant C). The oauth-provider plugin sends a signed-in browser
 * here with a signed query (a signed-out one goes to `/login` first, which resumes — 0.4a-2). In order:
 * MCP off → «MCP è disattivato», before asking anybody to sign in;
 * nobody signed in (the session lapsed between redirects) → `/login?{the same signed query}`;
 * a query `readConsentRequest` refuses → «Richiesta non valida» (or off, if it says so);
 * otherwise the client's card, the scopes and the answer.
 *
 * `adminContext` is used for what it is — the signed-in person's language and zone, without
 * `readPage`'s detour to `/onboarding` — so a member who never onboarded can still answer.
 */
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = consentSearchParams(await searchParams);
  const query = params.toString();
  const [instance, mcp, user] = await Promise.all([
    pageInstanceInfo(),
    pageMcpSetting(),
    currentUser(),
  ]);

  if (!mcp.value) {
    const { t } = user === null ? await publicI18n() : await userI18n(user.id);
    return (
      <div className={styles.column}>
        <Brand instanceName={instance.name} />
        <ConsentStop
          icon="plug"
          title={t('web.consent.disabledTitle')}
          body={t('web.consent.disabledBody')}
          back={t('web.consent.backToSaldo')}
        />
      </div>
    );
  }

  if (user === null) redirect(loginRedirect(query));

  const ctx = await adminContext(user);
  const { t } = ctx;
  const answer = await readConsentRequest(params, user.id);
  if (!answer.ok) {
    const off = answer.reason === 'disabled';
    return (
      <div className={styles.column}>
        <Brand instanceName={instance.name} />
        <ConsentStop
          icon={off ? 'plug' : 'info'}
          title={t(off ? 'web.consent.disabledTitle' : 'web.consent.invalidTitle')}
          body={t(off ? 'web.consent.disabledBody' : 'web.consent.invalidBody')}
          back={t('web.consent.backToSaldo')}
        />
      </div>
    );
  }

  const { request } = answer;
  const note = clientNote(request);
  const noteText =
    note === null
      ? null
      : 'dateIso' in note
        ? t(note.key, { date: ctx.formatDate.long(note.dateIso) })
        : t(note.key);
  const subtitle = [t('web.consent.returnsTo', { host: request.redirectHost }), noteText]
    .filter((part): part is string => part !== null)
    .join(' · ');
  const who = isSyntheticEmail(user.email) ? user.displayName : user.email;

  return (
    <div className={styles.column}>
      <Brand instanceName={instance.name} />
      <ConsentForm
        query={query}
        clientName={request.clientName}
        clientInitial={clientInitial(request.clientName)}
        subtitle={subtitle}
        fresh={request.fresh}
        requestedScopes={request.requestedScopes}
        userInitials={initials(user.displayName)}
        notYouHref={loginRedirect(query)}
        strings={{
          title: t('web.consent.title'),
          freshTitle: t('web.consent.freshTitle'),
          freshBody: t('web.consent.freshBody'),
          whatTitle: t('web.consent.whatTitle'),
          scopesLabel: t('web.consent.scopesLabel'),
          readTitle: t('web.consent.readTitle'),
          readBody: t('web.consent.readBody'),
          required: t('web.consent.required'),
          writeTitle: t('web.consent.writeTitle'),
          writeBody: t('web.consent.writeBody'),
          signedInAs: t('web.consent.signedInAs', { who }),
          notYou: t('web.consent.notYou'),
          authorize: t('web.consent.authorize'),
          authorizeReadOnly: t('web.consent.authorizeReadOnly'),
          deny: t('web.consent.deny'),
          busy: t('common.loading'),
          revocationNote: t('web.consent.revocationNote'),
          failed: t('web.consent.failed'),
          deniedTitle: t('web.consent.deniedTitle'),
          deniedBody: t('web.consent.deniedBody', { client: request.clientName }),
          back: t('web.consent.backToSaldo'),
        }}
      />
    </div>
  );
}
