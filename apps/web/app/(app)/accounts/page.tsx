import {
  canArchiveAccount,
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
  formatLongDate,
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
import { Fragment, type ReactNode } from 'react';
import { type AccountRowView, accountsView } from '../../../src/features/accounts/accountsView';
import { archivedView } from '../../../src/features/accounts/archivedView';
import { type AccountDetailView, accountDetail } from '../../../src/features/accounts/detailView';
import { type AccountFormView, accountFormView } from '../../../src/features/accounts/formView';
import {
  goalEditHref,
  goalExpenseHref,
  goalTransferHref,
} from '../../../src/features/accounts/goalLinks';
import { accountWriteErrors } from '../../../src/features/accounts/writeErrors';
import { accountMessages } from '../../../src/i18n/accountMessages';
import { readPage } from '../../../src/server/page/context';
import { AmountText } from '../../../src/ui/AmountText';
import { AppLink as Link } from '../../../src/ui/AppLink';
import { Card, CardGrid, CardHead, CardLabel, CardNote, CardSentence } from '../../../src/ui/Card';
import { ChartFrame } from '../../../src/ui/charts/ChartFrame';
import { Sparkline } from '../../../src/ui/charts/Sparkline';
import { EmptyState } from '../../../src/ui/EmptyState';
import { HeroFigure } from '../../../src/ui/HeroBand';
import { Icon } from '../../../src/ui/Icon';
import { IconBox } from '../../../src/ui/IconBox';
import { ListRow } from '../../../src/ui/ListRow';
import { PageHead } from '../../../src/ui/PageHead';
import { PanelLink } from '../../../src/ui/PanelNav';
import { type PanelSpec, PanelSwitch } from '../../../src/ui/PanelSwitch';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { Section } from '../../../src/ui/Section';
import { TargetRing } from '../../../src/ui/TargetRing';
import { AccountForm } from './AccountForm';
import {
  ArchiveAccount,
  ArchiveAccountShared,
  type ArchiveAccountSharedValue,
} from './ArchiveAccount';
import formStyles from './accountForms.module.css';
import styles from './accounts.module.css';
import { CloseGoal, CloseGoalShared, type CloseGoalSharedValue } from './CloseGoal';
import { RestoreButton } from './RestoreButton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/accounts';

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
 * Which query parameters open a panel (§17.1.7), with the precedence the page always had: `?new`
 * wins, then `?g=` over `?a=`, and a detail wins over `?archived`. `?a={id}&edit` is not a panel of
 * its own: `edit` is not a panel parameter, so a link to it changes more than the panel and
 * navigates, and the server then puts the edit form in place of the detail under `a:{id}`.
 */
const PANEL_PARAMS = {
  flags: ['new', 'archived'],
  values: ['g', 'a'],
  order: ['new', 'g', 'a', 'archived'],
} as const;

/** How many movements an account's or a goal's panel lists. */
const RECENT = 6;

/**
 * Conti on the web (§5.3, §5.14, §17.1.7): the band's two totals, the spendable and the savings
 * groups, and — in the trailing panel — one account's balance and recent movements (`?a=`) or one
 * pocket's goal (`?g=`). Every figure is `accountsView` and `accountDetail`, the same `@saldo/core`
 * the phone calls: nothing is added up here.
 *
 * The server renders the panel of every listed account and goal, «Nuovo conto» and the archived
 * list; a click only chooses the one to show (`PanelSwitch`). «Modifica conto» needs the account's
 * own balance, so it stays a navigation (`?a={id}&edit`), as a save, an archive and a close do.
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
  const accountsById = new Map(page.data.accounts.map((row) => [row.id, row]));
  const categories = new Map(page.data.categories.map((row) => [row.id, row]));

  const goalDeps: GoalTextDeps = {
    t,
    locale,
    money,
    today,
    periodKind: settings.periodKind,
  };

  const moneyParts = formatMoneyParts(0, currency, locale, 'never');
  const archived = archivedView(page.data);
  const archivedTotal = view.archivedCount + archived.goals.length;
  const writeErrors = accountWriteErrors(catalogs[locale].web.accounts);

  const accountCard = (row: AccountRowView) => {
    const detail = detailOf(row.account.id);
    const due = detail?.due ?? null;
    const owes = due !== null && due > 0;
    const change = detail === null ? 0 : detail.period.income - detail.period.spent;
    return (
      <Card
        key={row.account.id}
        href={`${PATH}?a=${row.account.id}`}
        selectId={`a:${row.account.id}`}
      >
        <CardHead
          leading={
            <IconBox name={row.account.icon as IconName} colorIndex={row.account.colorIndex} />
          }
          name={row.account.name}
        />
        <div>
          {owes ? <CardLabel>{t('accounts.toRepay')}</CardLabel> : null}
          <AmountText
            minor={owes ? due : row.balance}
            currency={currency}
            locale={locale}
            size="large"
          />
          <CardNote>
            {[
              row.account.institution ?? t(`accountTypes.${row.account.type}`),
              t('accounts.periodDelta', {
                amount: formatMoney(change, currency, locale, 'always'),
              }),
              row.pockets.length === 0 ? null : `${money(row.free)} ${t('goals.free')}`,
            ]
              .filter((part) => part !== null)
              .join(' · ')}
          </CardNote>
        </div>
        {detail === null ? null : <Sparkline series={detail.series} height={40} />}
      </Card>
    );
  };

  const goalCard = (pocket: AccountRowView['pockets'][number]) => {
    const detail = detailOf(pocket.account.id);
    const goal = detail?.goal ?? null;
    if (goal === null) return null;
    const subject: GoalTextSubject = { account: pocket.account, progress: goal };
    const { action } = goalSentence(subject, goalDeps);
    return (
      <Card
        key={pocket.account.id}
        href={`${PATH}?g=${pocket.account.id}`}
        selectId={`g:${pocket.account.id}`}
      >
        <CardHead
          leading={
            <TargetRing
              size={32}
              ratio={goal.ratio}
              pace={goalPace(goal)}
              tone={goalRingTone(goal)}
              icon={pocket.account.icon as IconName}
              colorIndex={pocket.account.colorIndex}
            />
          }
          name={pocket.account.name}
          meta={t('targets.percent', { value: Math.round(goal.ratio * 100) })}
          attention={goalRingTone(goal) === 'over'}
        />
        <div>
          <AmountText minor={goal.saved} currency={currency} locale={locale} size="large" />
          <CardNote>{goalOf(subject, goalDeps)}</CardNote>
        </div>
        <ProgressBar thick ratio={goal.ratio} pace={goalPace(goal)} tone={goalRingTone(goal)} />
        <CardSentence>
          <Rich text={richText(action, t, locale)} />
        </CardSentence>
      </Card>
    );
  };

  const cards = (rows: AccountRowView[]) =>
    rows.flatMap((row) => [accountCard(row), ...row.pockets.map(goalCard)]);

  const empty = view.spending.length === 0 && view.savings.length === 0;

  // The movements of the panels, newest first, sorted once for every panel.
  const past = page.data.transactions.filter((tx) => tx.date <= today).sort(newestFirst);
  const recentOf = (accountId: string) =>
    past
      .filter((tx) => tx.accountId === accountId || tx.toAccountId === accountId)
      .slice(0, RECENT);

  const recentRow = (accountId: string, tx: (typeof past)[number]) => {
    const row = transactionRow(tx, {
      category: (categoryId) => categories.get(categoryId),
      accountName: (id) => accountNames.get(id) ?? '',
      kindLabel: (kind) => t(`kinds.${kind}`),
      viewpointAccountId: accountId,
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

  /** The account panel (§5.3): what it holds or owes, its sparkline, its statement and its period. */
  const accountBody = (selected: AccountDetailView) => {
    // A card in debt shows what it owes, everything else its balance — a card never holds a pocket
    // (§5.14), so its balance is always its own.
    const heroDue = selected.due !== null && selected.due > 0;
    const heroLabel = heroDue ? t('accounts.toRepay') : t('accounts.balance');
    const heroAmount = heroDue ? (selected.due ?? 0) : selected.balance;
    // The statement rows: the same figures, the same fallback date, as the phone's account screen
    // box (`apps/mobile/app/account/[id].tsx`).
    const statement = selected.statement;
    const statementDue = statement?.due ?? 0;
    const chargeDate = statementDue > 0 ? (statement?.chargeDate ?? null) : null;
    const statementPaid = statement !== null && statement.statement > 0 && statement.due === 0;
    const recent = recentOf(selected.account.id);
    return (
      <>
        <div className={formStyles.actions}>
          <Link className={formStyles.actionLink} href={`${PATH}?a=${selected.account.id}&edit`}>
            {t('common.edit')}
          </Link>
          {canArchiveAccount(page.data.accounts, selected.account.id) ? (
            <ArchiveAccount
              id={selected.account.id}
              updatedAt={selected.account.updatedAt}
              body={t('web.accounts.archiveBody', { name: selected.account.name })}
            />
          ) : (
            <span className={formStyles.muted}>{t('goals.closeFirst')}</span>
          )}
        </div>
        <span className={styles.label}>{heroLabel}</span>
        <AmountText minor={heroAmount} currency={currency} locale={locale} size="hero" />
        <Sparkline series={selected.series} />

        {statement === null ? null : (
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
          {recent.length === 0 ? (
            <EmptyState title={t('transactions.empty')} />
          ) : (
            recent.map((tx) => recentRow(selected.account.id, tx))
          )}
        </Section>
      </>
    );
  };

  /** The goal panel (§5.14): the ring, the sentence, the figures, the movements and the close. */
  const goalBody = (selected: AccountDetailView, goal: GoalProgress) => {
    const parentId = selected.account.parentAccountId;
    const goalParent = parentId == null ? null : (accountsById.get(parentId) ?? null);
    const parentLive = goalParent !== null && goalParent.archivedAt === null;
    const subject: GoalTextSubject = { account: selected.account, progress: goal };
    const { action, state } = goalSentence(subject, goalDeps);
    const recent = recentOf(selected.account.id);
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
            <AmountText minor={goal.saved} currency={currency} locale={locale} size="title" />
            <span className={styles.note}>{goalOf(subject, goalDeps)}</span>
          </div>
        </div>
        <p className={styles.sentence}>
          <Rich text={richText(action, t, locale)} />
          {state === null ? null : <span className={styles.note}> {state}</span>}
        </p>

        {parentLive ? (
          <div className={formStyles.actions}>
            <Link
              className={formStyles.actionLink}
              href={goalTransferHref(parentId ?? '', selected.account.id, selected.account.name)}
            >
              {t('goals.setAside')}
            </Link>
            <Link
              className={formStyles.actionLink}
              href={goalTransferHref(selected.account.id, parentId ?? '', selected.account.name)}
            >
              {t('goals.withdraw')}
            </Link>
          </div>
        ) : null}

        <div className={styles.cardRows}>
          <ListRow
            title={t('goals.parent')}
            trailing={<span className={styles.count}>{goalParent?.name ?? '—'}</span>}
          />
          <ListRow
            title={t('goals.deadline')}
            trailing={
              <span className={styles.count}>
                {selected.account.goalDeadline == null
                  ? t('goals.deadlineNone')
                  : formatLongDate(selected.account.goalDeadline, locale)}
              </span>
            }
          />
          <ListRow
            title={t('goals.createdOn')}
            trailing={
              <span className={styles.count}>
                {formatLongDate(selected.account.goalStartDate ?? today, locale)}
              </span>
            }
          />
        </div>

        <Section title={t('goals.movements')}>
          {recent.length === 0 ? (
            <EmptyState title={t('goals.noMovements')} />
          ) : (
            recent.map((tx) => recentRow(selected.account.id, tx))
          )}
        </Section>

        <div className={formStyles.actions}>
          <Link className={formStyles.actionLink} href={goalEditHref(selected.account.id)}>
            {t('common.edit')}
          </Link>
          <CloseGoal
            id={selected.account.id}
            updatedAt={selected.account.updatedAt}
            expenseHref={
              goal.saved > 0
                ? goalExpenseHref(selected.account.id, goal.saved, selected.account.name)
                : null
            }
            body={
              goal.saved > 0
                ? t('goals.closeBody', { amount: money(goal.saved) })
                : t('goals.closeEmpty')
            }
            returnTo={t('goals.returnTo', { name: goalParent?.name ?? '' })}
          />
        </div>
      </>
    );
  };

  const formBody = (form: AccountFormView, closeHref: string) => (
    <AccountForm
      view={form}
      locale={locale}
      currency={currency}
      decimalSeparator={moneyParts.decimalSeparator}
      symbol={moneyParts.symbol}
      symbolPosition={moneyParts.symbolPosition}
      messages={accountMessages(catalogs[locale])}
      closeHref={closeHref}
      afterSave={`${PATH}?a=__ID__`}
    />
  );

  // Every panel the page can open, rendered here: a click only chooses one (`PanelSwitch`).
  const panels: Record<string, PanelSpec> = {};
  const fresh = accountFormView({ data: page.data, today, currency, mode: 'new', id: null });
  if (fresh !== null) {
    panels.new = {
      title: t('accounts.newAccount'),
      sheet: true,
      bare: true,
      body: formBody(fresh, PATH),
    };
  }
  panels.archived = {
    title: t('web.accounts.archivedTitle'),
    body:
      archived.accounts.length === 0 && archived.goals.length === 0 ? (
        <EmptyState title={t('accounts.archivedEmpty')} />
      ) : (
        <>
          {archived.accounts.length === 0 ? null : (
            <Section title={t('web.accounts.archivedAccounts')}>
              {archived.accounts.map((row) => (
                <ListRow
                  key={row.id}
                  leading={
                    <span className={formStyles.faded}>
                      <IconBox name={row.icon as IconName} colorIndex={row.colorIndex} />
                    </span>
                  }
                  title={row.name}
                  subtitle={t('accounts.archivedBadge')}
                  trailing={
                    <RestoreButton
                      id={row.id}
                      kind="account"
                      label={t('accounts.restore')}
                      busyLabel={t('common.loading')}
                      errors={writeErrors}
                    />
                  }
                />
              ))}
            </Section>
          )}
          {archived.goals.length === 0 ? null : (
            <Section title={t('web.accounts.closedGoals')}>
              {archived.goals.map((row) => (
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
        </>
      ),
  };

  // The listed accounts and goals, and the one the URL names when the list does not show it: a
  // transaction's panel links to the account of each side, which can be a pocket or an archived
  // account, and an MCP link can name any account or goal.
  const rows = [...view.spending, ...view.savings];
  const accountIds = new Set(rows.map((row) => row.account.id));
  const goalIds = new Set(rows.flatMap((row) => row.pockets.map((pocket) => pocket.account.id)));
  if (params.a !== undefined && params.a !== '') accountIds.add(params.a);
  if (params.g !== undefined && params.g !== '') goalIds.add(params.g);
  const detailOf = (id: string) => accountDetail({ data: page.data, id, today, def });

  // The head's sparkline: every live account's month-end balances, added up month by month.
  // `netWorth` sums every non-archived account, pockets included (each holds its own balance),
  // so the series does the same.
  const live = page.data.accounts.filter((account) => account.archivedAt === null);
  const netWorthSeries = live
    .map((account) => detailOf(account.id)?.series ?? [])
    .reduce<number[]>((sum, series) => series.map((value, index) => value + (sum[index] ?? 0)), []);

  // `?a={id}&edit` opens «Modifica conto» under the key `a:{id}` when that key is the one the URL
  // opens. The form needs the account's own balance, so only that account gets one, and a link to
  // it navigates. ✕ and «Annulla» go back to the detail, `?a={id}`: a navigation too.
  const editId =
    params.edit !== undefined && params.new === undefined && params.g === undefined
      ? params.a
      : undefined;
  const editing =
    editId === undefined
      ? null
      : accountFormView({ data: page.data, today, currency, mode: 'edit', id: editId });

  for (const id of accountIds) {
    const key = `a:${id}`;
    if (editing !== null && editing.id === id) {
      panels[key] = {
        title: t('accounts.editAccount'),
        sheet: true,
        bare: true,
        closeTo: key,
        body: formBody(editing, `${PATH}?a=${id}`),
      };
      continue;
    }
    const detail = detailOf(id);
    if (detail === null) continue;
    panels[key] = { title: detail.account.name, body: accountBody(detail) };
  }
  for (const id of goalIds) {
    const detail = detailOf(id);
    if (detail === null || detail.goal === null) continue;
    panels[`g:${id}`] = { title: detail.account.name, body: goalBody(detail, detail.goal) };
  }

  const archiveShared: ArchiveAccountSharedValue = {
    afterHref: PATH,
    strings: {
      action: t('accounts.archive'),
      title: t('accounts.archive'),
      confirm: t('common.archive'),
      cancel: t('common.cancel'),
      busy: t('common.loading'),
      errors: writeErrors,
    },
  };
  const closeGoalShared: CloseGoalSharedValue = {
    afterHref: PATH,
    strings: {
      action: t('goals.close'),
      fundedTitle: t('goals.closeTitle'),
      confirm: t('goals.confirmClose'),
      recordExpense: t('goals.recordExpense'),
      cancel: t('common.cancel'),
      busy: t('common.loading'),
      errors: writeErrors,
    },
  };

  return (
    <ArchiveAccountShared value={archiveShared}>
      <CloseGoalShared value={closeGoalShared}>
        <div className={styles.layout}>
          <PanelSwitch
            baseHref={PATH}
            params={PANEL_PARAMS}
            panels={panels}
            closeLabel={t('common.close')}
          >
            <div className={styles.list}>
              <PageHead
                title={
                  <div className={styles.titleRow}>
                    <h1 className={styles.title}>{t('accounts.title')}</h1>
                    <PanelLink className={styles.newAccount} href={`${PATH}?new`}>
                      <Icon name="plus" size={16} />
                      {t('accounts.newAccount')}
                    </PanelLink>
                  </div>
                }
                hero={
                  <Figure label={t('accounts.netWorth')}>
                    <AmountText
                      minor={view.netWorth}
                      currency={currency}
                      locale={locale}
                      size="hero"
                    />
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
                aside={
                  netWorthSeries.length < 2 ? undefined : (
                    <ChartFrame
                      title={plural(t, locale, 'accounts.netWorthTrend', netWorthSeries.length)}
                      value={
                        <AmountText
                          minor={view.netWorth}
                          currency={currency}
                          locale={locale}
                          size="footnote"
                        />
                      }
                    >
                      <Sparkline series={netWorthSeries} height={96} />
                    </ChartFrame>
                  )
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
                    <CardGrid>{cards(view.spending)}</CardGrid>
                  </Section>
                  <Section
                    open
                    title={t('accounts.savings')}
                    trailing={t('accounts.outsideSpendable')}
                  >
                    <CardGrid>
                      {cards(view.savings)}
                      <Card ghost href={`${PATH}?new`} selectId="new">
                        <CardLabel>{t('accounts.newAccount')}</CardLabel>
                        <p className={styles.note}>{t('accounts.newAccountBody')}</p>
                      </Card>
                    </CardGrid>
                  </Section>
                </>
              )}

              {archivedTotal === 0 ? (
                <p className={styles.note}>{t('profile.archivedAccounts')}</p>
              ) : (
                <ListRow
                  open
                  href={`${PATH}?archived`}
                  selectId="archived"
                  title={t('profile.archivedAccounts')}
                  trailing={<span className={styles.count}>{archivedTotal}</span>}
                />
              )}
            </div>
          </PanelSwitch>
        </div>
      </CloseGoalShared>
    </ArchiveAccountShared>
  );
}
