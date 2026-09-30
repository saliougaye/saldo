import { type GoalView, goalTone, goalViews, pocketParentCandidates } from '@saldo/core';
import { catalogs, formatMoney, formatMoneyParts, type GoalTextDeps, goalOf } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import Link from 'next/link';
import { archivedView } from '../../../../src/features/accounts/archivedView';
import { goalFormView } from '../../../../src/features/accounts/formView';
import { goalAccountsHref, NEW_GOAL_HREF } from '../../../../src/features/accounts/goalLinks';
import { accountWriteErrors } from '../../../../src/features/accounts/writeErrors';
import { accountMessages } from '../../../../src/i18n/accountMessages';
import { readPage } from '../../../../src/server/page/context';
import { AmountText } from '../../../../src/ui/AmountText';
import { Icon } from '../../../../src/ui/Icon';
import { IconBox } from '../../../../src/ui/IconBox';
import { ListRow } from '../../../../src/ui/ListRow';
import { Section } from '../../../../src/ui/Section';
import { TargetRing } from '../../../../src/ui/TargetRing';
import formStyles from '../../accounts/accountForms.module.css';
import { GoalForm } from '../../accounts/GoalForm';
import { RestoreButton } from '../../accounts/RestoreButton';
import { ProfilePanel } from '../ProfilePanel';
import styles from './goals.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/profile/goals';

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
  const { t, locale, currency, today, def, params, settings } = page;
  const items = goalViews(page.data.accounts, page.data.transactions, today, def);
  const closed = archivedView(page.data).goals;
  const canCreate = pocketParentCandidates(page.data.accounts).length > 0;

  const money = (minor: number) => formatMoney(minor, currency, locale);
  const goalDeps: GoalTextDeps = { t, locale, money, today, periodKind: settings.periodKind };
  const writeErrors = accountWriteErrors(catalogs[locale].web.accounts);

  // `?new` wins over `?g=`; an id that is not an open goal opens nothing.
  const creating = params.new !== undefined && canCreate;
  const editing = creating ? undefined : items.find((item) => item.account.id === params.g);
  const form =
    creating || editing !== undefined
      ? goalFormView({
          data: page.data,
          today,
          currency,
          mode: creating ? 'new' : 'edit',
          id: creating ? null : (editing?.account.id ?? null),
        })
      : null;
  const parentName = editing?.parent?.name ?? null;
  const moneyParts = formatMoneyParts(0, currency, locale, 'never');

  const tone = (item: GoalView): 'normal' | 'over' | 'done' => {
    const value = goalTone(item.progress);
    return value === 'attention' ? 'over' : value === 'plain' ? 'normal' : 'done';
  };

  return (
    <>
      <Section
        open
        title={t('goals.title')}
        trailing={
          canCreate ? (
            <Link className={styles.newGoal} href={NEW_GOAL_HREF}>
              <Icon name="plus" size={16} />
              {t('goals.newGoal')}
            </Link>
          ) : null
        }
      >
        {items.length === 0 ? <p className={styles.note}>{t('goals.emptyBody')}</p> : null}
        {canCreate ? null : <p className={styles.note}>{t('web.accounts.goalNeedsAccount')}</p>}
        {items.map((item) => (
          <ListRow
            key={item.account.id}
            open
            href={`${PATH}?g=${item.account.id}`}
            selected={editing?.account.id === item.account.id}
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

      {form === null ? null : (
        <ProfilePanel
          key="form"
          sheet
          bare
          title={t(form.mode === 'new' ? 'goals.newGoal' : 'goals.editGoal')}
          closeHref={PATH}
          closeLabel={t('common.close')}
        >
          <GoalForm
            key={`${form.mode}:${form.id ?? ''}`}
            view={form}
            locale={locale}
            currency={currency}
            decimalSeparator={moneyParts.decimalSeparator}
            symbol={moneyParts.symbol}
            symbolPosition={moneyParts.symbolPosition}
            messages={accountMessages(catalogs[locale])}
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
        </ProfilePanel>
      )}
    </>
  );
}
