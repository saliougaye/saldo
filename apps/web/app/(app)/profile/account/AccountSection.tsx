import { emailRowState } from '../../../../src/features/profile/emailRow';
import { ADMIN_ROLE } from '../../../../src/server/auth/admin';
import { currentUser } from '../../../../src/server/auth/currentUser';
import { MAX_DISPLAY_NAME_LENGTH } from '../../../../src/server/auth/displayName';
import { pendingEmailChange } from '../../../../src/server/auth/emailChange';
import { getDb } from '../../../../src/server/db/client';
import { readPage } from '../../../../src/server/page/context';
import { pageMailEnabled } from '../../../../src/server/page/instanceSettings';
import { PanelLink } from '../../../../src/ui/PanelNav';
import { type PanelSpec, PanelSwitch } from '../../../../src/ui/PanelSwitch';
import { SettingsBox, SettingsSection } from '../../../../src/ui/SettingsSection';
import appStyles from '../../app.module.css';
import styles from './account.module.css';
import { ChangeEmailForm } from './ChangeEmailForm';
import { NameForm } from './NameForm';
import { VerifyEmailButton } from './VerifyEmailButton';

/** `?edit=name` opens «Modifica» on the name, `?edit=email` «Cambia email». Anything else, nothing. */
const PANEL_PARAMS = { flags: [], values: ['edit'] } as const;

/**
 * Profilo → Profilo (§17.1.4, spec §06): three rows — the name with «Modifica», the address with
 * «Cambia email», and the role, which only an admin changes. Each change opens in the dialog through
 * `?edit=`, in place (`PanelSwitch`). «Cambia email» shows only where the change can be proved: a
 * real address on a server that can mail. The section is at `/profile` and at `/profile/account`,
 * so `path` is where its links and its dialogs come back to.
 */
export async function AccountSection({
  path,
  searchParams,
}: {
  path: '/profile' | '/profile/account';
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await readPage(searchParams);
  const { t } = page;
  // `currentUser` is the request's cached session read; `readPage` already went through it.
  const verified = (await currentUser())?.emailVerified ?? false;
  const state = emailRowState({
    email: page.user.email,
    emailVerified: verified,
    mailEnabled: await pageMailEnabled(),
  });
  // A real address on a server that can mail: the only case where a change can be proved.
  const canChange = state === 'verified' || state === 'canVerify';
  const pending = canChange ? await pendingEmailChange(getDb(), page.user.id, new Date()) : null;
  const pendingLine =
    pending === null ? null : t('web.account.changePending', { email: pending.email });

  const panels: Record<string, PanelSpec> = {
    'edit:name': {
      title: t('web.account.nameTitle'),
      form: true,
      body: (
        <NameForm
          value={page.user.displayName}
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          closeHref={path}
          strings={{
            field: t('web.auth.nameLabel'),
            hint: t('web.account.nameHint'),
            cancel: t('common.cancel'),
            save: t('common.save'),
            busy: t('common.loading'),
            keyboardHint: t('web.form.keyboardHint'),
            empty: t('web.account.nameEmpty'),
            tooLong: t('web.account.nameTooLong', { max: MAX_DISPLAY_NAME_LENGTH }),
            failed: t('web.auth.genericError'),
          }}
        />
      ),
    },
  };
  if (canChange) {
    panels['edit:email'] = {
      title: t('web.account.changeEmail'),
      form: true,
      body: (
        <ChangeEmailForm
          strings={{
            label: t('web.account.changeLabel'),
            send: t('web.account.changeSend'),
            working: t('common.loading'),
            pending: pendingLine,
            sent: pending === null ? null : t('web.account.changeSent', { email: pending.email }),
            cancel: t('web.account.changeCancel'),
            invalid: t('web.account.changeInvalid'),
            same: t('web.account.changeSame'),
            later: t('web.account.changeLater'),
            failed: t('web.auth.genericError'),
          }}
        />
      ),
    };
  }

  return (
    <PanelSwitch
      baseHref={path}
      params={PANEL_PARAMS}
      panels={panels}
      closeLabel={t('common.close')}
      slot
    >
      <SettingsSection title={t('profile.title')}>
        <SettingsBox>
          <dl className={styles.rows}>
            <div className={styles.row}>
              <dt className={styles.label}>{t('web.auth.nameLabel')}</dt>
              <dd className={styles.value}>{page.user.displayName}</dd>
              <PanelLink className={styles.action} href={`${path}?edit=name`}>
                {t('web.account.nameEdit')}
              </PanelLink>
            </div>
            <div className={styles.row}>
              <dt className={styles.label}>{t('web.auth.emailLabel')}</dt>
              <dd className={styles.value}>
                {state === 'synthetic' ? t('admin.noEmail') : page.user.email}
                {state === 'synthetic' ? null : (
                  <small className={styles.note}>
                    {t(state === 'verified' ? 'web.account.verified' : 'web.account.unverified')}
                  </small>
                )}
                {pendingLine === null ? null : <small className={styles.note}>{pendingLine}</small>}
              </dd>
              {canChange ? (
                <PanelLink className={styles.action} href={`${path}?edit=email`}>
                  {t('web.account.changeEmail')}
                </PanelLink>
              ) : (
                <span />
              )}
            </div>
            <div className={styles.row}>
              <dt className={styles.label}>{t('admin.role')}</dt>
              <dd className={styles.value}>
                {t(page.user.role === ADMIN_ROLE ? 'admin.roleAdmin' : 'admin.roleMember')}
              </dd>
              <span />
            </div>
          </dl>
        </SettingsBox>
        {state === 'canVerify' ? (
          <VerifyEmailButton
            email={page.user.email}
            strings={{
              send: t('web.account.verify'),
              working: t('common.loading'),
              sent: t('web.account.verifySent', { email: page.user.email }),
              failed: t('web.auth.genericError'),
            }}
          />
        ) : null}
        {state === 'mailOff' ? <p className={appStyles.meta}>{t('web.account.mailOff')}</p> : null}
      </SettingsSection>
    </PanelSwitch>
  );
}
