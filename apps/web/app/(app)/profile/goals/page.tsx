import {
  emergencyFundTarget,
  type GoalView,
  getCurrency,
  goalTone,
  goalViews,
  pocketParentCandidates,
} from '@saldo/core';
import { catalogs, formatMoney, formatMoneyParts, type GoalTextDeps, goalOf } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { archivedView } from '../../../../src/features/accounts/archivedView';
import {
  type GoalFormView,
  goalFormView,
  goalParentOptions,
} from '../../../../src/features/accounts/formView';
import {
  goalAccountsHref,
  goalPrefillFrom,
  goalPresets,
  NEW_GOAL_HREF,
} from '../../../../src/features/accounts/goalLinks';
import { accountWriteErrors } from '../../../../src/features/accounts/writeErrors';
import { accountMessages } from '../../../../src/i18n/accountMessages';
import { readPage } from '../../../../src/server/page/context';
import { AmountText } from '../../../../src/ui/AmountText';
import { AppLink as Link } from '../../../../src/ui/AppLink';
import { Icon } from '../../../../src/ui/Icon';
import { IconBox } from '../../../../src/ui/IconBox';
import { ListRow } from '../../../../src/ui/ListRow';
import { PanelLink } from '../../../../src/ui/PanelNav';
import { type PanelSpec, PanelSwitch } from '../../../../src/ui/PanelSwitch';
import { Section } from '../../../../src/ui/Section';
import { TargetRing } from '../../../../src/ui/TargetRing';
import formStyles from '../../accounts/accountForms.module.css';
import accountStyles from '../../accounts/accounts.module.css';
import { GoalForm, GoalFormProvider, type GoalFormSharedValue } from '../../accounts/GoalForm';
import { RestoreButton } from '../../accounts/RestoreButton';
import styles from './goals.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/profile/goals';

/**
 * `?new` opens «Nuovo obiettivo» (only when an account can hold a goal), `?g={id}` one open goal;
 * `?new` wins. An id that is not an open goal opens nothing.
 */
const PANEL_PARAMS = { flags: ['new'], values: ['g'] } as const;

/** The ring beside a row: the same 28px Home and Conti draw. */
const ROW_RING = 28;

/**
 * Profilo → Obiettivi (§5.14, §17.1.7): the open goals with a ring each, the closed ones with
 * «Ripristina», and the goal form in the profile panel — `?new` for «Nuovo obiettivo», `?g={id}`
 * to edit one. Figures are `goalViews`, which Home calls; movements and «Chiudi» stay in Conti.
 */
export default async function ProfileGoalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await readPage(searchParams);
  const { t, locale, currency, today, def, settings, params } = page;
  const items = goalViews(page.data.accounts, page.data.transactions, today, def);
  const closed = archivedView(page.data).goals;
  const canCreate = pocketParentCandidates(page.data.accounts).length > 0;

  const money = (minor: number) => formatMoney(minor, currency, locale);
  const goalDeps: GoalTextDeps = { t, locale, money, today, periodKind: settings.periodKind };
  const writeErrors = accountWriteErrors(catalogs[locale].web.accounts);

  const moneyParts = formatMoneyParts(0, currency, locale, 'never');
  // What every form shares goes once to the provider; a body gets only what is its own.
  const shared: GoalFormSharedValue = {
    parents: goalParentOptions(page.data),
    decimalSeparator: moneyParts.decimalSeparator,
    symbol: moneyParts.symbol,
    symbolPosition: moneyParts.symbolPosition,
    messages: accountMessages(catalogs[locale]),
  };
  const formOf = (id: string | null) =>
    goalFormView({
      data: page.data,
      today,
      currency,
      mode: id === null ? 'new' : 'edit',
      id,
      // W11: a preset's link fills in the name and the target of the new form.
      prefill: id === null ? goalPrefillFrom(params, getCurrency(currency).minorDigits) : undefined,
    });
  const formBody = (form: GoalFormView, parentName: string | null) => (
    <>
      <GoalForm
        view={form}
        parentName={parentName}
        closeHref={PATH}
        afterSave={`${PATH}?g=__ID__`}
      />
      {form.id === null ? null : (
        <div className={styles.panelLinks}>
          <Link className={formStyles.actionLink} href={goalAccountsHref(form.id)}>
            {t('web.accounts.openInAccounts')}
          </Link>
        </div>
      )}
    </>
  );

  // Every panel the page can open, rendered here: a click only chooses one (`PanelSwitch`). A save
  // stays a navigation (to `?g=ID`), so the list shows what the server holds; «Apri in Conti» goes
  // to another page.
  const panels: Record<string, PanelSpec> = {};
  const fresh = canCreate ? formOf(null) : null;
  if (fresh !== null) {
    panels.new = {
      title: t('goals.newGoal'),
      form: true,
      bare: true,
      body: formBody(fresh, null),
    };
  }
  for (const item of items) {
    const form = formOf(item.account.id);
    if (form === null) continue;
    panels[`g:${item.account.id}`] = {
      title: t('goals.editGoal'),
      form: true,
      bare: true,
      body: formBody(form, item.parent?.name ?? null),
    };
  }

  // W11: the emergency fund is 3 times the median monthly spend; holiday and car have no figure.
  const presets = goalPresets({
    names: [t('goals.presetEmergency'), t('goals.presetHoliday'), t('goals.presetCar')],
    emergency: emergencyFundTarget({ txs: page.data.transactions, def, today }),
  });

  const tone = (item: GoalView): 'normal' | 'over' | 'done' => {
    const value = goalTone(item.progress);
    return value === 'attention' ? 'over' : value === 'plain' ? 'normal' : 'done';
  };

  return (
    <GoalFormProvider value={shared}>
      <PanelSwitch
        baseHref={PATH}
        params={PANEL_PARAMS}
        panels={panels}
        closeLabel={t('common.close')}
        slot
      >
        <Section
          open
          title={t('goals.title')}
          trailing={
            canCreate ? (
              <PanelLink className={styles.newGoal} href={NEW_GOAL_HREF}>
                <Icon name="plus" size={16} />
                {t('goals.newGoal')}
              </PanelLink>
            ) : null
          }
        >
          {items.length === 0 ? <p className={styles.note}>{t('goals.emptyBody')}</p> : null}
          {items.length === 0 && canCreate ? (
            <div className={styles.presets}>
              {presets.map((preset) => (
                <Link key={preset.key} className={accountStyles.type} href={preset.href}>
                  <b>{preset.name}</b>
                  {preset.amount === null ? null : <span>{money(preset.amount)}</span>}
                </Link>
              ))}
            </div>
          ) : null}
          {canCreate ? null : <p className={styles.note}>{t('web.accounts.goalNeedsAccount')}</p>}
          {items.map((item) => (
            <ListRow
              key={item.account.id}
              open
              href={`${PATH}?g=${item.account.id}`}
              selectId={`g:${item.account.id}`}
              leading={
                <TargetRing
                  size={ROW_RING}
                  ratio={item.progress.ratio}
                  pace={null}
                  tone={tone(item)}
                  icon={item.account.icon as IconName}
                  colorIndex={item.account.colorIndex}
                />
              }
              title={item.account.name}
              subtitle={item.parent?.name}
              trailing={
                <span className={styles.rowAmount}>
                  <AmountText minor={item.progress.saved} currency={currency} locale={locale} />
                  <span className={styles.rowOf}>{goalOf(item, goalDeps)}</span>
                </span>
              }
            />
          ))}
        </Section>

        {closed.length === 0 ? null : (
          <Section open title={t('web.accounts.closedGoals')}>
            {closed.map((row) => (
              <ListRow
                key={row.id}
                leading={
                  <span className={formStyles.faded}>
                    <IconBox name={row.icon as IconName} colorIndex={row.colorIndex} />
                  </span>
                }
                title={row.name}
                subtitle={row.parentName}
                trailing={
                  <RestoreButton
                    id={row.id}
                    kind="goal"
                    label={t('accounts.restore')}
                    busyLabel={t('common.loading')}
                    errors={writeErrors}
                    disabledNote={row.canRestore ? undefined : t('goals.parentArchived')}
                  />
                }
              />
            ))}
          </Section>
        )}
      </PanelSwitch>
    </GoalFormProvider>
  );
}
