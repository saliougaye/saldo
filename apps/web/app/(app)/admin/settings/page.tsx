import type { IconName } from '@saldo/ui';
import { settingsErrorStrings } from '../../../../src/features/admin/errorStrings';
import { resolveMessage } from '../../../../src/features/admin/resolveMessage';
import {
  DEFAULT_SMTP_PORT,
  lockedVariables,
  MAX_INSTANCE_NAME_LENGTH,
  registrationChoices,
  SETTINGS_PATH,
  type SettingsPanelId,
  settingsRows,
} from '../../../../src/features/admin/settingsView';
import { requireWebAdmin } from '../../../../src/server/auth/currentUser';
import { getDb } from '../../../../src/server/db/client';
import { adminContext } from '../../../../src/server/page/adminContext';
import { readServerSettings, smtpView } from '../../../../src/server/settings/serverSettings';
import { Alert } from '../../../../src/ui/Alert';
import { Icon } from '../../../../src/ui/Icon';
import { type PanelSpec, PanelSwitch } from '../../../../src/ui/PanelSwitch';
import { SettingsBox, SettingsSection } from '../../../../src/ui/SettingsSection';
import { SummaryRow } from '../../../../src/ui/SummaryRow';
import styles from '../admin.module.css';
import { NamePanel } from './NamePanel';
import { RegistrationPanel } from './RegistrationPanel';
import { SmtpPanel } from './SmtpPanel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** `?edit=name|registration|smtp` opens a panel. Anything else opens nothing. */
const PANEL_PARAMS = { flags: [], values: ['edit'] } as const;

const ICONS: Record<SettingsPanelId, IconName> = {
  name: 'house',
  registration: 'shield',
  smtp: 'inbox',
};

/**
 * Admin → Impostazioni (§17.1.7, §17.1.8): the three server settings the admin can change without
 * a restart — the instance name, who may register, and the outgoing mail. `?edit=name|registration|smtp`
 * opens a panel in place (`PanelSwitch`); anything else opens nothing. A setting the environment
 * sets is shown locked: the panel names the variable and offers nothing to save.
 *
 * The page renders the three panels on every load. The SMTP setting reaches this page as
 * `smtpView`'s result — host, port, user, sender and whether a password is set — and the client
 * components below get only that. The password, stored or from the environment, is opened by
 * `smtpForSending` and nowhere on a page; a locked SMTP panel names the variables and shows no value.
 */
export default async function AdminSettingsPage() {
  const admin = await requireWebAdmin();
  const db = getDb();
  const [ctx, settings, smtp] = await Promise.all([
    adminContext(admin),
    readServerSettings(db),
    smtpView(db),
  ]);
  const { t } = ctx;
  const input = {
    instanceName: settings.instanceName,
    registration: settings.registration,
    smtp,
  };
  const rows = settingsRows(input);
  const errors = settingsErrorStrings(t);
  const say = (message: Parameters<typeof resolveMessage>[0]) =>
    resolveMessage(message, { t, locale: ctx.locale, formatDate: ctx.formatDate.long });

  const common = {
    cancel: t('common.cancel'),
    save: t('common.save'),
    busy: t('common.loading'),
    keyboardHint: t('web.form.keyboardHint'),
  };

  /** «Impostata dall'ambiente» and the variables, for a panel whose setting the environment sets. */
  const lockedAlert = (id: SettingsPanelId) => {
    const variables = lockedVariables(id, input);
    if (variables.length === 0) return null;
    const list = variables
      .map((variable) =>
        variable.value === null ? variable.name : `${variable.name}=${variable.value}`,
      )
      .join(', ');
    return (
      <Alert
        title={t('admin.settings.locked.title')}
        body={t(
          variables.length === 1 ? 'admin.settings.locked.body' : 'admin.settings.locked.bodyGroup',
          {
            variables: list,
          },
        )}
      />
    );
  };

  const view = smtp.value;
  const passwordState = (() => {
    if (view === null || !view.passwordSet) return 'none' as const;
    return view.passwordReadable ? ('set' as const) : ('unreadable' as const);
  })();

  // Every panel the page can open, rendered here: a click only chooses one (`PanelSwitch`).
  // A save of the name or of the mode goes to the list; a save of the mail refreshes in place.
  const panels: Record<`edit:${SettingsPanelId}`, PanelSpec> = {
    'edit:name': {
      title: t('admin.settings.name.title'),
      form: true,
      body: (
        <div className={styles.form}>
          {lockedAlert('name')}
          <NamePanel
            // A name that is only the default is not stored: the field starts empty and shows it as a hint.
            value={settings.instanceName.source === 'default' ? '' : settings.instanceName.value}
            placeholder={
              settings.instanceName.source === 'default' ? settings.instanceName.value : undefined
            }
            locked={settings.instanceName.source === 'env'}
            closeHref={SETTINGS_PATH}
            maxLength={MAX_INSTANCE_NAME_LENGTH}
            strings={{
              field: t('admin.settings.name.field'),
              hint: t('admin.settings.name.hint'),
              ...common,
              errors,
            }}
          />
        </div>
      ),
    },
    'edit:registration': {
      title: t('admin.settings.registration.title'),
      form: true,
      body: (
        <div className={styles.form}>
          {lockedAlert('registration')}
          <RegistrationPanel
            value={settings.registration.value}
            options={registrationChoices().map((choice) => ({
              value: choice.value,
              label: t(choice.labelKey),
              subtitle: t(choice.noteKey),
            }))}
            locked={settings.registration.source === 'env'}
            closeHref={SETTINGS_PATH}
            strings={{ title: t('admin.settings.registration.title'), ...common, errors }}
          />
        </div>
      ),
    },
    'edit:smtp': {
      title: t('admin.settings.smtp.title'),
      form: true,
      body: (
        <div className={styles.form}>
          <p className={styles.note}>{t('admin.settings.smtp.note')}</p>
          {lockedAlert('smtp')}
          <SmtpPanel
            initial={{
              host: view?.host ?? '',
              port: String(view?.port ?? DEFAULT_SMTP_PORT),
              user: view?.user ?? '',
              from: view?.from ?? '',
            }}
            password={passwordState}
            configured={view !== null}
            hasRow={smtp.source === 'database'}
            locked={smtp.source === 'env'}
            closeHref={SETTINGS_PATH}
            strings={{
              host: t('admin.settings.smtp.host'),
              port: t('admin.settings.smtp.port'),
              user: t('admin.settings.smtp.user'),
              password: t('admin.settings.smtp.password'),
              passwordSet: t('admin.settings.smtp.passwordSet'),
              replace: t('admin.settings.smtp.replace'),
              passwordHint: t('admin.settings.smtp.passwordHint'),
              passwordUnreadable: t('admin.settings.smtp.passwordUnreadable'),
              from: t('admin.settings.smtp.from'),
              test: t('admin.settings.smtp.test'),
              testSaveFirst: t('admin.settings.smtp.testSaveFirst'),
              remove: t('admin.settings.smtp.remove'),
              removeTitle: t('admin.settings.smtp.removeTitle'),
              removeBody: t('admin.settings.smtp.removeBody'),
              removeConfirm: t('admin.settings.smtp.removeConfirm'),
              saved: t('admin.settings.saved'),
              testSent: t('admin.settings.test.sent', { email: '{{email}}' }),
              testSyntheticEmail: t('admin.settings.test.syntheticEmail'),
              testNotConfigured: t('admin.settings.test.notConfigured'),
              testFailed: t('admin.settings.test.failed', { detail: '{{detail}}' }),
              testFailedNoDetail: t('admin.settings.test.failedNoDetail'),
              ...common,
              errors,
            }}
          />
        </div>
      ),
    },
  };

  return (
    <PanelSwitch
      baseHref={SETTINGS_PATH}
      params={PANEL_PARAMS}
      panels={panels}
      closeLabel={t('common.close')}
      slot
    >
      <SettingsSection title={t('admin.settings.title')} trailing={t('admin.settings.trailing')}>
        <SettingsBox>
          <div>
            {rows.map((row) => (
              <SummaryRow
                key={row.id}
                href={`${SETTINGS_PATH}?edit=${row.id}`}
                selectId={`edit:${row.id}`}
                leading={
                  <span className={styles.tile} aria-hidden="true">
                    <Icon name={ICONS[row.id]} size={16} />
                  </span>
                }
                title={t(row.labelKey)}
                subtitle={say(row.subtitle)}
                value={
                  row.value === null ? undefined : row.ok ? (
                    <span className={styles.secret}>
                      <span className={styles.dotOk} aria-hidden="true" />
                      {say(row.value)}
                    </span>
                  ) : (
                    say(row.value)
                  )
                }
              />
            ))}
          </div>
        </SettingsBox>
      </SettingsSection>
    </PanelSwitch>
  );
}
