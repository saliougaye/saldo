import { redirect } from 'next/navigation';
import {
  emailStatusKey,
  isSetupMode,
  lockedNoteKey,
  SMTP_SETTINGS_PATH,
  setupModeChoices,
} from '../../src/features/setup/setupView';
import { publicI18n } from '../../src/i18n/server';
import { getDb } from '../../src/server/db/client';
import { describeInstance } from '../../src/server/instance';
import { setupState } from '../../src/server/setup/state';
import styles from '../(auth)/auth.module.css';
import { SetupFlow } from './SetupFlow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOTAL_STEPS = 2;

/**
 * 0.3h: the first-run wizard. It renders only while the instance has no account (`setupState`);
 * afterwards `/` decides, as it always did. Everything the client flow shows is resolved here.
 */
export default async function SetupPage() {
  const state = await setupState(getDb());
  if (!state.needed) redirect('/');
  const { t, locale } = await publicI18n();
  const instance = describeInstance(state.instanceName.value);
  const lockedKey = lockedNoteKey(state.lockedVariables);
  const { registration } = state;
  return (
    <div className={styles.column}>
      <SetupFlow
        locale={locale}
        instance={instance}
        initialName={state.instanceName.source === 'default' ? '' : state.instanceName.value}
        nameLocked={state.instanceName.locked}
        // A value the list does not offer (`first-user`, unless the environment locks it) starts
        // the list on the recommended row rather than on none.
        initialMode={
          registration.locked || isSetupMode(registration.value) ? registration.value : 'invite'
        }
        modeLocked={registration.locked}
        modeChoices={setupModeChoices(registration.value, registration.locked).map((choice) => ({
          value: choice.value,
          label: t(choice.labelKey),
          subtitle: t(choice.noteKey),
          detail: choice.recommended ? t('setup.recommended') : undefined,
        }))}
        lockedNote={
          lockedKey === null ? null : t(lockedKey, { variables: state.lockedVariables.join(', ') })
        }
        mail={state.mail}
        smtpSettingsHref={SMTP_SETTINGS_PATH}
        strings={{
          welcomeTitle: t('setup.welcomeTitle'),
          welcomeBody: t('setup.welcomeBody', { host: instance.host }),
          welcomeHint: t('setup.welcomeHint'),
          version: t('setup.version'),
          database: t('setup.database'),
          databaseOk: t('setup.databaseOk'),
          accounts: t('setup.accounts'),
          accountsNone: t('setup.accountsNone'),
          start: t('common.start'),
          serverTitle: t('setup.serverTitle'),
          serverBody: t('setup.serverBody'),
          nameLabel: t('setup.nameLabel'),
          namePlaceholder: t('setup.namePlaceholder'),
          registrationLabel: t('setup.registrationLabel'),
          continue: t('common.continue'),
          back: t('common.back'),
          working: t('common.loading'),
          accountTitle: t('setup.accountTitle'),
          // `{{instance}}` stays: the flow fills it with the name typed in step 1, which this page
          // does not know. The same goes for `doneBody` and `inviteOnce`.
          accountBody: t('setup.accountBody'),
          yourNameLabel: t('setup.yourNameLabel'),
          yourNamePlaceholder: t('setup.yourNamePlaceholder'),
          emailLabel: t('web.auth.emailLabel'),
          emailPlaceholder: t('web.auth.emailPlaceholder'),
          emailHint: t('web.auth.emailHint'),
          createButton: t('setup.createButton'),
          waiting: t('setup.waiting'),
          passkeyHint: t('setup.passkeyHint'),
          doneTitle: t('setup.doneTitle'),
          doneBody: t('setup.doneBody'),
          summaryInstance: t('setup.summaryInstance'),
          summaryRegistration: t('setup.summaryRegistration'),
          summaryEmail: t('setup.summaryEmail'),
          emailStatus: t(emailStatusKey(state.mail)),
          emailConfigure: t('setup.emailConfigure'),
          inviteTitle: t('setup.inviteTitle'),
          optional: t('setup.optional'),
          inviteFor: t('setup.inviteFor'),
          inviteForPlaceholder: t('setup.inviteForPlaceholder'),
          inviteCreate: t('setup.inviteCreate'),
          inviteCreated: t('setup.inviteCreated'),
          inviteLink: t('setup.inviteLink'),
          copyLink: t('setup.copyLink'),
          copied: t('setup.copied'),
          inviteOnce: t('setup.inviteOnce'),
          go: t('setup.go'),
          errorAlreadySetUp: t('setup.errors.alreadySetUp'),
          errorInvalid: t('setup.errors.invalid'),
          errorUnexpected: t('setup.errors.unexpected'),
          nameTooLong: t('setup.nameTooLong'),
          // The alerts of the ceremony, by the keys `describeAuthError` answers with.
          'web.auth.emailTakenTitle': t('web.auth.emailTakenTitle'),
          'web.auth.emailTakenBody': t('web.auth.emailTakenBody'),
          'web.auth.closedTitle': t('web.auth.closedTitle'),
          'web.auth.closedBody': t('web.auth.closedBody'),
          'web.auth.emailInvalid': t('web.auth.emailInvalid'),
          'web.auth.emailHint': t('web.auth.emailHint'),
          'web.auth.genericError': t('web.auth.genericError'),
          'web.auth.crossDeviceHint': t('web.auth.crossDeviceHint'),
          'web.auth.nameRequiredTitle': t('web.auth.nameRequiredTitle'),
          'web.auth.nameRequiredBody': t('web.auth.nameRequiredBody'),
          'web.auth.invalidInviteTitle': t('web.auth.invalidInviteTitle'),
          'web.auth.invalidInviteBody': t('web.auth.invalidInviteBody'),
          // A cancelled ceremony says the mockup's words here, not `/register`'s.
          'sync.cancelled': t('setup.cancelledTitle'),
          'web.auth.cancelledBody': t('setup.cancelledBody'),
        }}
        stepLabels={Array.from({ length: TOTAL_STEPS }, (_, index) =>
          t('common.stepOf', { step: index + 1, total: TOTAL_STEPS }),
        )}
      />
    </div>
  );
}
