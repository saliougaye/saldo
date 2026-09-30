import { catalogs, formatMoney, formatMoneyParts } from '@saldo/i18n';
import Link from 'next/link';
import { budgetRowFor } from '../../../src/features/budgets/budgetRow';
import { budgetsView } from '../../../src/features/budgets/budgetsView';
import { budgetFormView } from '../../../src/features/budgets/formView';
import { budgetMessages } from '../../../src/i18n/budgetMessages';
import { readPage } from '../../../src/server/page/context';
import { EmptyState } from '../../../src/ui/EmptyState';
import { Icon } from '../../../src/ui/Icon';
import { Panel } from '../../../src/ui/Panel';
import { BudgetForm } from './BudgetForm';
import styles from './budgets.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/budgets';

/**
 * Budget on the web (§5.8, §17.1.7): the open list Home draws, a ring per row, and the form in the
 * trailing panel — `?new` for «Nuovo budget», `?b={id}` to edit one. A budget has no read-only
 * detail here (its chart stays on the phone), so a row opens its form. Every figure is
 * `budgetsView`, which Home calls too.
 */
export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await readPage(searchParams);
  const { t, locale, currency, today, def, period, params } = page;
  const view = budgetsView({ data: page.data, today, def, period });

  const money = (minor: number) => formatMoney(minor, currency, locale);
  const percent = (ratio: number) => t('targets.percent', { value: Math.round(ratio * 100) });

  // `?new` wins over `?b=`; an id that is not a live budget opens nothing.
  const creating = params.new !== undefined;
  const editing = creating ? undefined : view.items.find((item) => item.budget.id === params.b);
  const form =
    creating || editing !== undefined
      ? budgetFormView({
          data: page.data,
          today,
          def,
          period,
          currency,
          mode: creating ? 'new' : 'edit',
          id: creating ? null : (editing?.budget.id ?? null),
        })
      : null;
  const moneyParts = formatMoneyParts(0, currency, locale, 'never');

  const rows = budgetRowFor({
    t,
    money,
    percent,
    categories: page.data.categories,
    styles,
    href: (item) => `${PATH}?b=${item.budget.id}`,
    selectedId: editing?.budget.id ?? null,
  });

  return (
    <div className={styles.layout}>
      <div className={styles.list}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{t('budgets.title')}</h1>
          <Link className={styles.newBudget} href={`${PATH}?new`}>
            <Icon name="plus" size={16} />
            {t('budgets.newBudget')}
          </Link>
        </div>

        {view.items.length === 0 ? (
          <EmptyState title={t('budgets.empty')} body={t('budgets.emptyBody')} />
        ) : (
          <div>{view.items.map(rows.row)}</div>
        )}
      </div>

      {form === null ? null : (
        <Panel
          key="form"
          sheet
          bare
          title={t(form.mode === 'new' ? 'budgets.newBudget' : 'budgets.editBudget')}
          closeHref={PATH}
          closeLabel={t('common.close')}
        >
          <BudgetForm
            // A switch between «Nuovo» and «Modifica», or between two budgets, is a new form.
            key={`${form.mode}:${form.id ?? ''}`}
            view={form}
            locale={locale}
            currency={currency}
            decimalSeparator={moneyParts.decimalSeparator}
            symbol={moneyParts.symbol}
            symbolPosition={moneyParts.symbolPosition}
            messages={budgetMessages(catalogs[locale])}
            closeHref={PATH}
            afterSave={PATH}
            savedName={editing?.budget.name ?? null}
          />
        </Panel>
      )}
    </div>
  );
}
