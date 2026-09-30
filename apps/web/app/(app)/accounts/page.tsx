import {
  type GoalProgress,
  goalPace,
  goalTone,
  newestFirst,
  nextCreditChargeDate,
  transactionRow,
} from '@saldo/core';
import {
  catalogs,
  formatDayMonth,
  formatDayMonthLong,
  formatMoney,
  formatMoneyParts,
  type GoalTextDeps,
  type GoalTextSubject,
  goalOf,
  goalSentence,
  plural,
  richText,
} from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { type AccountRowView, accountsView } from '../../../src/features/accounts/accountsView';
import { accountDetail } from '../../../src/features/accounts/detailView';
import { accountFormView } from '../../../src/features/accounts/formView';
import { accountMessages } from '../../../src/i18n/accountMessages';
import { readPage } from '../../../src/server/page/context';
import { AmountText } from '../../../src/ui/AmountText';
import { Sparkline } from '../../../src/ui/charts/Sparkline';
import { EmptyState } from '../../../src/ui/EmptyState';
import { HeroBand, HeroFigure } from '../../../src/ui/HeroBand';
import { Icon } from '../../../src/ui/Icon';
import { ListRow } from '../../../src/ui/ListRow';
import { Panel } from '../../../src/ui/Panel';
import { Section } from '../../../src/ui/Section';
import { TargetRing } from '../../../src/ui/TargetRing';
import { AccountForm } from './AccountForm';
import formStyles from './accountForms.module.css';
import styles from './accounts.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/accounts';

/** The ring beside a pocket row: the same 28px Home draws beside a goal or a budget. */
const ROW_RING = 28;

/** The ring on the goal panel: bigger, because there is nothing else in it to look at. */
const GOAL_RING = 72;

/** A key figure of the band: the label, the amount, and the line the design puts under it. */
function Figure({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <HeroFigure label={label}>
      {children}
      {note === undefined || note === '' ? null : <span className={styles.note}>{note}</span>}
    </HeroFigure>
  );
}

interface Segment {
  key: string;
  text: string;
  strong: boolean;
}

/** The catalogs' one piece of markup: `<b>` around the figure a goal sentence is about (§5.14). */
function segments(text: string): Segment[] {
  return text
    .split(/<b>|<\/b>/)
    .map((part, index) => ({ key: `${index}`, text: part, strong: index % 2 === 1 }));
}

/** What `<Trans>` does on the phone, for a server component with no i18next around it. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {segments(text).map((segment) =>
        segment.strong ? (
          <b key={segment.key}>{segment.text}</b>
        ) : (
          <Fragment key={segment.key}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}

/** `attention` → the ring's `over` stroke, `done` → `done`, `plain` → `normal` (§5.13, §5.14). */
function goalRingTone(progress: GoalProgress): 'normal' | 'over' | 'done' {
  const tone = goalTone(progress);
  return tone === 'attention' ? 'over' : tone === 'plain' ? 'normal' : 'done';
}

/**
 * Conti on the web (§5.3, §5.14, §17.1.7): the band's two totals, the spendable and the savings
 * groups, and — in the trailing panel — one account's balance and recent movements (`?a=`) or one
 * pocket's goal (`?g=`). Every figure is `accountsView` and `accountDetail`, the same `@saldo/core`
 * the phone calls: nothing is added up here.
 */
export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await readPage(searchParams);
  const { t, locale, currency, today, def, params, settings } = page;
  const view = accountsView({ data: page.data, today, def });

  const money = (minor: number) => formatMoney(minor, currency, locale);
  const accountNames = new Map(page.data.accounts.map((row) => [row.id, row.name]));
  const categories = new Map(page.data.categories.map((row) => [row.id, row]));

  const goalDeps: GoalTextDeps = {
    t,
    locale,
    money,
    today,
    periodKind: settings.periodKind,
  };

  // `?g=` wins over `?a=` when a hand-edited URL somehow carries both: a pocket is never reached
  // through `?a=`, so there is nothing useful the other parameter could mean alongside it.
  const goalId = params.g;
  const accountId = params.a;
  const selectedId = goalId ?? accountId;
  const selected =
    selectedId === undefined
      ? null
      : accountDetail({ data: page.data, id: selectedId, today, def });
  const showGoalPanel = goalId !== undefined && selected !== null && selected.goal !== null;
  const showAccountPanel = !showGoalPanel && accountId !== undefined && selected !== null;

  // `?new` opens «Nuovo conto»; `?a={id}&edit` opens «Modifica conto». Presence is what counts.
  const creating = params.new !== undefined;
  const editing = !creating && showAccountPanel && params.edit !== undefined;
  const form =
    creating || editing
      ? accountFormView({
          data: page.data,
          today,
          currency,
          mode: creating ? 'new' : 'edit',
          id: creating ? null : (selected?.account.id ?? null),
        })
      : null;
  const formCloseHref = form?.id == null ? PATH : `${PATH}?a=${form.id}`;
  const moneyParts = formatMoneyParts(0, currency, locale, 'never');

  const accountRow = (row: AccountRowView) => (
    <ListRow
      key={row.account.id}
      open
      href={`/accounts?a=${row.account.id}`}
      selected={accountId === row.account.id}
      icon={row.account.icon as IconName}
      colorIndex={row.account.colorIndex}
      title={row.account.name}
      subtitle={row.account.institution ?? t(`accountTypes.${row.account.type}`)}
      trailing={<AmountText minor={row.balance} currency={currency} locale={locale} />}
    />
  );

  const pocketRow = (pocket: AccountRowView['pockets'][number]) => (
    <div key={pocket.account.id} className={styles.pocketRow}>
      <ListRow
        open
        href={`/accounts?g=${pocket.account.id}`}
        selected={goalId === pocket.account.id}
        leading={
          <TargetRing
            size={ROW_RING}
            ratio={pocket.ratio}
            pace={null}
            tone={pocket.ratio >= 1 ? 'done' : 'normal'}
            icon={pocket.account.icon as IconName}
            colorIndex={pocket.account.colorIndex}
          />
        }
        title={pocket.account.name}
        trailing={<AmountText minor={pocket.saved} currency={currency} locale={locale} />}
      />
    </div>
  );

  const group = (row: AccountRowView) => (
    <Fragment key={row.account.id}>
      {accountRow(row)}
      {row.pockets.length === 0 ? null : (
        <>
          {row.pockets.map(pocketRow)}
          <div className={styles.pocketRow}>
            <ListRow
              open
              title={t('goals.free')}
              trailing={<AmountText minor={row.free} currency={currency} locale={locale} muted />}
            />
          </div>
        </>
      )}
    </Fragment>
  );

  const empty = view.spending.length === 0 && view.savings.length === 0;

  const recentTransactions =
    selected === null
      ? []
      : [...page.data.transactions]
          .filter(
            (tx) =>
              (tx.accountId === selected.account.id || tx.toAccountId === selected.account.id) &&
              tx.date <= today,
          )
          .sort(newestFirst)
          .slice(0, 6);

  const recentRow = (tx: (typeof recentTransactions)[number]) => {
    if (selected === null) return null;
    const row = transactionRow(tx, {
      category: (categoryId) => categories.get(categoryId),
      accountName: (id) => accountNames.get(id) ?? '',
      kindLabel: (kind) => t(`kinds.${kind}`),
      viewpointAccountId: selected.account.id,
    });
    return (
      <ListRow
        key={tx.id}
        href={`/transactions?t=${tx.id}`}
        icon={row.icon as IconName}
        colorIndex={row.colorIndex}
        title={row.title}
        subtitle={formatDayMonth(tx.date, locale)}
        trailing={
          <AmountText
            minor={row.amount.minor}
            currency={currency}
            locale={locale}
            sign={row.amount.signDisplay}
            muted={row.amount.muted}
          />
        }
      />
    );
  };

  // The account panel's hero (§5.3): a card in debt shows what it owes, everything else its balance
  // — a card never holds a pocket (§5.14), so its balance is always its own.
  const heroDue = selected !== null && selected.due !== null && selected.due > 0;
  const heroLabel = heroDue ? t('accounts.toRepay') : t('accounts.balance');
  const heroAmount = selected === null ? 0 : heroDue ? (selected.due ?? 0) : selected.balance;

  // The statement rows (§5.3): the same figures, the same fallback date, as the phone's account
  // screen box (`apps/mobile/app/account/[id].tsx`).
  const statement = selected?.statement ?? null;
  const statementDue = statement?.due ?? 0;
  const chargeDate = statementDue > 0 ? (statement?.chargeDate ?? null) : null;
  const statementPaid = statement !== null && statement.statement > 0 && statement.due === 0;

  return (
    <div className={styles.layout}>
      <div className={styles.list}>
        <HeroBand
          period={
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{t('accounts.title')}</h1>
              <Link className={styles.newAccount} href={`${PATH}?new`}>
                <Icon name="plus" size={16} />
                {t('accounts.newAccount')}
              </Link>
            </div>
          }
          hero={
            <Figure label={t('accounts.netWorth')}>
              <AmountText minor={view.netWorth} currency={currency} locale={locale} size="hero" />
            </Figure>
          }
          stats={
            <Figure label={t('accounts.spendable')} note={t('accounts.spendableNote')}>
              <AmountText
                minor={view.spendable}
                currency={currency}
                locale={locale}
                size="headline"
              />
            </Figure>
          }
        />

        {empty ? (
          <EmptyState title={t('accounts.empty')} />
        ) : (
          <>
            <Section
              open
              title={t('accounts.spending')}
              trailing={plural(t, locale, 'accounts.count', view.spending.length)}
            >
              {view.spending.map(group)}
            </Section>

            {view.savings.length === 0 ? null : (
              <Section open title={t('accounts.savings')} trailing={t('accounts.outsideSpendable')}>
                {view.savings.map(group)}
              </Section>
            )}
          </>
        )}

        {/* The archived list is a 0.3e screen (§17.1.9): with nowhere to send it yet, the row never
            links — at zero there is also nothing to count, so it reads as a plain line instead of a
            row that looks like it leads somewhere. */}
        {view.archivedCount === 0 ? (
          <p className={styles.note}>{t('profile.archivedAccounts')}</p>
        ) : (
          <ListRow
            open
            title={t('profile.archivedAccounts')}
            trailing={<span className={styles.count}>{view.archivedCount}</span>}
          />
        )}
      </div>

      {form === null ? null : (
        <Panel
          // Not the detail's panel: closing the form mounts the detail fresh, not one still leaving.
          key="form"
          sheet
          bare
          title={t(form.mode === 'new' ? 'accounts.newAccount' : 'accounts.editAccount')}
          closeHref={formCloseHref}
          closeLabel={t('common.close')}
        >
          <AccountForm
            // A switch between «Nuovo» and «Modifica», or between two accounts, is a new form.
            key={`${form.mode}:${form.id ?? ''}`}
            view={form}
            locale={locale}
            currency={currency}
            decimalSeparator={moneyParts.decimalSeparator}
            symbol={moneyParts.symbol}
            symbolPosition={moneyParts.symbolPosition}
            messages={accountMessages(catalogs[locale])}
            closeHref={formCloseHref}
            afterSave={`${PATH}?a=__ID__`}
          />
        </Panel>
      )}

      {form !== null || !showAccountPanel || selected === null ? null : (
        <Panel
          key="detail"
          title={selected.account.name}
          closeHref={PATH}
          closeLabel={t('common.close')}
        >
          <div className={formStyles.actions}>
            <Link className={formStyles.actionLink} href={`${PATH}?a=${selected.account.id}&edit`}>
              {t('common.edit')}
            </Link>
            {/* «Archivia» (Task 10) joins this row when the account holds no open goal. */}
          </div>
          <span className={styles.label}>{heroLabel}</span>
          <AmountText minor={heroAmount} currency={currency} locale={locale} size="hero" />
          <Sparkline series={selected.series} />

          {selected.statement === null ? null : (
            <div className={styles.cardRows}>
              {selected.account.creditCloseDay === null ? null : (
                <ListRow
                  title={t('accounts.accruedInCycle')}
                  trailing={
                    <AmountText minor={selected.accrued ?? 0} currency={currency} locale={locale} />
                  }
                />
              )}
              {selected.account.creditChargeDay === null ? null : (
                <ListRow
                  title={t('accounts.nextCharge')}
                  subtitle={
                    chargeDate === null
                      ? formatDayMonthLong(
                          nextCreditChargeDate(selected.account.creditChargeDay, today),
                          locale,
                        )
                      : `${formatDayMonthLong(chargeDate, locale)} · ${t('accounts.statementShort')}`
                  }
                  trailing={
                    chargeDate === null ? (
                      statementPaid ? (
                        <span className={styles.paid}>
                          <Icon name="check" size={14} />
                          {t('accounts.paidShort')}
                        </span>
                      ) : null
                    ) : (
                      <AmountText minor={statementDue} currency={currency} locale={locale} />
                    )
                  }
                />
              )}
            </div>
          )}

          <div className={styles.periodRow}>
            <div>
              <span className={styles.label}>{t('home.income')}</span>
              <AmountText minor={selected.period.income} currency={currency} locale={locale} />
            </div>
            <div>
              <span className={styles.label}>{t('home.expenses')}</span>
              <AmountText minor={selected.period.spent} currency={currency} locale={locale} />
            </div>
          </div>

          <Section title={t('accounts.lastTransactions')}>
            {recentTransactions.length === 0 ? (
              <EmptyState title={t('transactions.empty')} />
            ) : (
              recentTransactions.map(recentRow)
            )}
          </Section>
        </Panel>
      )}

      {!showGoalPanel || selected === null || selected.goal === null ? null : (
        <Panel title={selected.account.name} closeHref={PATH} closeLabel={t('common.close')}>
          {(() => {
            const goal = selected.goal;
            const subject: GoalTextSubject = { account: selected.account, progress: goal };
            const { action, state } = goalSentence(subject, goalDeps);
            const sentence = <Rich text={richText(action, t, locale)} />;
            return (
              <>
                <div className={styles.goalHead}>
                  <TargetRing
                    size={GOAL_RING}
                    ratio={goal.ratio}
                    pace={goalPace(goal)}
                    tone={goalRingTone(goal)}
                  />
                  <div>
                    <AmountText
                      minor={goal.saved}
                      currency={currency}
                      locale={locale}
                      size="title"
                    />
                    <span className={styles.note}>{goalOf(subject, goalDeps)}</span>
                  </div>
                </div>
                <p className={styles.sentence}>
                  {sentence}
                  {state === null ? null : <span className={styles.note}> {state}</span>}
                </p>
              </>
            );
          })()}
        </Panel>
      )}
    </div>
  );
}
