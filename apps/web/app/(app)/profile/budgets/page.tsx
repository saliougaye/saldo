import { budgetSuggestions } from '@saldo/core';
import { catalogs, formatMoney, formatMoneyParts, plural } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { budgetRowFor } from '../../../../src/features/budgets/budgetRow';
import { budgetsView } from '../../../../src/features/budgets/budgetsView';
import {
  type BudgetFormView,
  budgetFormShared,
  budgetFormView,
  budgetPrefillFrom,
} from '../../../../src/features/budgets/formView';
import { budgetMessages } from '../../../../src/i18n/budgetMessages';
import { readPage } from '../../../../src/server/page/context';
import { EmptyState } from '../../../../src/ui/EmptyState';
import { Icon } from '../../../../src/ui/Icon';
import { ListRow } from '../../../../src/ui/ListRow';
import { PanelLink } from '../../../../src/ui/PanelNav';
import { type PanelSpec, PanelSwitch } from '../../../../src/ui/PanelSwitch';
import { SettingsBox, SettingsSection } from '../../../../src/ui/SettingsSection';
import { BudgetForm, BudgetFormProvider, type BudgetFormSharedValue } from './BudgetForm';
import styles from './budgets.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/profile/budgets';

/** `?new` opens «Nuovo budget», `?b={id}` one budget; `?new` wins. An id that is not a live budget opens nothing. */
const PANEL_PARAMS = { flags: ['new'], values: ['b'] } as const;

/**
 * Profilo → Budget (§5.8, §17.1.7): the open list Home draws, a ring per row, and the form in the
 * profile panel — `?new` for «Nuovo budget», `?b={id}` to edit one. A budget has no read-only
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

  const moneyParts = formatMoneyParts(0, currency, locale, 'never');
  // What every form shares goes once to the provider; a body gets only what is its own.
  const shared: BudgetFormSharedValue = {
    ...budgetFormShared({ data: page.data, today, def, period }),
    locale,
    currency,
    decimalSeparator: moneyParts.decimalSeparator,
    symbol: moneyParts.symbol,
    symbolPosition: moneyParts.symbolPosition,
    messages: budgetMessages(catalogs[locale]),
  };
  const formOf = (id: string | null) =>
    budgetFormView({
      data: page.data,
      currency,
      mode: id === null ? 'new' : 'edit',
      id,
      // W11: a suggestion's link fills in the category and the amount of the new form.
      prefill: id === null ? budgetPrefillFrom(params, page.data, currency) : undefined,
    });
  const formBody = (form: BudgetFormView, savedName: string | null) => (
    <BudgetForm view={form} closeHref={PATH} afterSave={PATH} savedName={savedName} />
  );

  // Every panel the page can open, rendered here: a click only chooses one (`PanelSwitch`). A save
  // and a delete stay navigations, so the list shows what the server holds.
  const panels: Record<string, PanelSpec> = {};
  const fresh = formOf(null);
  if (fresh !== null) {
    panels.new = {
      title: t('budgets.newBudget'),
      form: true,
      body: formBody(fresh, null),
    };
  }
  for (const item of view.items) {
    const form = formOf(item.budget.id);
    if (form === null) continue;
    panels[`b:${item.budget.id}`] = {
      title: t('budgets.editBudget'),
      form: true,
      body: formBody(form, item.budget.name),
    };
  }

  const rows = budgetRowFor({
    t,
    money,
    percent,
    categories: page.data.categories,
    styles,
    href: (item) => `${PATH}?b=${item.budget.id}`,
    selectId: (item) => `b:${item.budget.id}`,
  });

  // W11: with no budget, the categories where the user spends most, each one a click from its form.
  const suggestions = budgetSuggestions({
    txs: page.data.transactions,
    categories: page.data.categories,
    budgets: page.data.budgets,
    def,
    period: period.range,
    today,
  });

  return (
    <BudgetFormProvider value={shared}>
      <PanelSwitch
        baseHref={PATH}
        params={PANEL_PARAMS}
        panels={panels}
        closeLabel={t('common.close')}
        slot
      >
        <SettingsSection
          title={t('budgets.title')}
          trailing={
            <PanelLink className={styles.newBudget} href={`${PATH}?new`}>
              <Icon name="plus" size={16} />
              {t('budgets.newBudget')}
            </PanelLink>
          }
        >
          {/* W11: with no budget, the suggestions are the block; otherwise the rows, or the empty text. */}
          {view.items.length > 0 || suggestions.length === 0 ? (
            <SettingsBox>
              {view.items.length === 0 ? (
                <EmptyState title={t('budgets.empty')} body={t('budgets.emptyBody')} />
              ) : (
                <div>{view.items.map(rows.row)}</div>
              )}
            </SettingsBox>
          ) : (
            <section className={styles.suggest} aria-labelledby="suggest-title">
              <div className={styles.suggestHead}>
                <h3 id="suggest-title" className={styles.suggestTitle}>
                  {t('budgets.suggestTitle')}
                </h3>
                <span className={styles.suggestNote}>{t(`budgets.suggestNote_${def.kind}`)}</span>
              </div>
              <p className={styles.suggestLead}>{t('budgets.suggestLead')}</p>
              {suggestions.map((suggestion) => {
                const category = page.data.categories.find(
                  (row) => row.id === suggestion.categoryId,
                );
                return (
                  <ListRow
                    key={suggestion.categoryId}
                    open
                    icon={category?.icon as IconName | undefined}
                    colorIndex={category?.colorIndex}
                    title={category?.name ?? t('common.missing')}
                    subtitle={plural(t, locale, 'transactions.periodCount', suggestion.txCount)}
                    trailing={
                      <span className={styles.suggestTrailing}>
                        <span className={styles.suggestAmount}>
                          {t(`budgets.suggestAmount_${def.kind}`, {
                            amount: money(suggestion.amount),
                          })}
                        </span>
                        <PanelLink
                          className={styles.newBudget}
                          href={`${PATH}?new&category=${encodeURIComponent(suggestion.categoryId)}&amount=${suggestion.amount}`}
                        >
                          {t('budgets.create')}
                        </PanelLink>
                      </span>
                    }
                  />
                );
              })}
            </section>
          )}
        </SettingsSection>
      </PanelSwitch>
    </BudgetFormProvider>
  );
}
