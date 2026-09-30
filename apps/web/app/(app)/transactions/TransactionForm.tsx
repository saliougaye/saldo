'use client';

import {
  amountBufferToMinor,
  type CurrencyCode,
  canCreateTag,
  changeKind,
  dateChoices,
  fillsFromBalances,
  type MissingField,
  minorToAmountBuffer,
  missingForSave,
  previewFromBalances,
  type TransactionFormValues,
  type TransactionKind,
  tagSuggestions,
  transferOverdrawsSource,
  transferOverpaysCard,
} from '@saldo/core';
import { type AppLocale, formatMoney } from '@saldo/i18n/format';
import { makeTranslator } from '@saldo/i18n/translate';
import type { IconName } from '@saldo/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type KeyboardEvent,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { accountsFor, type FormView } from '../../../src/features/transactions/formView';
import type { FormMessages } from '../../../src/i18n/formMessages';
import { Alert } from '../../../src/ui/Alert';
import { AmountField } from '../../../src/ui/AmountField';
import { Button } from '../../../src/ui/Button';
import { Icon } from '../../../src/ui/Icon';
import { IconBox } from '../../../src/ui/IconBox';
import { Segmented } from '../../../src/ui/Segmented';
import { Select, type SelectOption } from '../../../src/ui/Select';
import { Switch } from '../../../src/ui/Switch';
import { TextField } from '../../../src/ui/TextField';
import { createTagAction, saveTransactionAction } from './actions';
import styles from './TransactionForm.module.css';

interface Props {
  view: FormView;
  locale: AppLocale;
  currency: CurrencyCode;
  decimalSeparator: string;
  symbol: string;
  symbolPosition: 'prefix' | 'suffix';
  messages: FormMessages;
  closeHref: string;
  /** `/transactions?…&t=__ID__`: where a save lands. */
  afterSave: string;
}

const KINDS: readonly TransactionKind[] = ['expense', 'income', 'transfer'];

/** Which field a gap names, so pressing save can move the focus onto it. */
const FIELD_OF: Record<MissingField, string> = {
  amount: 'amount',
  account: 'account',
  category: 'category',
  destination: 'destination',
  sameAccount: 'destination',
  insufficientFunds: 'amount',
};

/** What stands above the foot: a gap the form found, or an answer the server gave. */
type Problem = { missing: MissingField } | { error: string } | null;

/**
 * «Nuova transazione» and «Modifica transazione» on the web (§17.1.7): the mockup's form in the
 * trailing panel. Every rule is `@saldo/core`'s — the same calls the phone's form makes; this
 * component only wires the fields to them and the save button to `saveTransactionAction`.
 */
export function TransactionForm({
  view,
  locale,
  currency,
  decimalSeparator,
  symbol,
  symbolPosition,
  messages,
  closeHref,
  afterSave,
}: Props) {
  const t = useMemo(() => makeTranslator(messages), [messages]);
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<TransactionFormValues>(view.initial);
  const [problem, setProblem] = useState<Problem>(null);
  const [pending, startTransition] = useTransition();
  const [tags, setTags] = useState(view.tags);
  const [tagQuery, setTagQuery] = useState('');
  // The suggestions appear when the tag field first takes the focus and stay: collapsing them on
  // blur moved everything below by a row between a press and its click (the «Escludi» switch lost
  // its first click), and kept Tab from ever reaching them.
  const [tagsOpen, setTagsOpen] = useState(false);
  const [allCategories, setAllCategories] = useState(false);
  const { minorDigits, today } = view;

  const money = (minor: number) => formatMoney(minor, currency, locale);
  const set = (patch: Partial<TransactionFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setProblem(null);
  };

  // The transfer's balances: `now` over the whole ledger, `without` with the edited row left out.
  const now = useMemo(
    () => new Map(view.accounts.map((account) => [account.id, account.balanceNow])),
    [view.accounts],
  );
  const without = useMemo(
    () => new Map(view.accounts.map((account) => [account.id, account.balance])),
    [view.accounts],
  );
  const transfer = values.kind === 'transfer';
  const amount = amountBufferToMinor(values.buffer, minorDigits);
  const draft = {
    id: view.id ?? 'draft',
    amount,
    date: values.date,
    fromAccountId: values.accountId,
    toAccountId: values.toAccountId,
  };
  const preview = transfer
    ? previewFromBalances(now, without, draft, today)
    : { from: null, to: null };
  const source = view.accounts.find((account) => account.id === values.accountId);
  const destination = view.accounts.find((account) => account.id === values.toAccountId);
  const overdrawn = transferOverdrawsSource(source, preview.from);
  const overpays = transferOverpaysCard(destination, preview.to);
  const fills = transfer ? fillsFromBalances(view.accounts, without, draft) : [];

  const direction = values.kind === 'income' ? 'income' : 'expense';
  const categories = view.categories.filter((category) => category.direction === direction);
  const tiles = view.top[direction].flatMap((id) => {
    const category = categories.find((entry) => entry.id === id);
    return category === undefined ? [] : [category];
  });
  // A category chosen from the full list stays visible as one more tile, selected.
  const chosen = categories.find((category) => category.id === values.categoryId);
  if (chosen !== undefined && !tiles.includes(chosen)) tiles.push(chosen);

  const suggestions = tagSuggestions(tags, [], tagQuery, values.tagIds);
  const creatable = canCreateTag(tags, tagQuery);

  // Only the edited row's own account or category can be archived (`formView`): it says so, as the
  // list's filter menus do.
  const accountOption = (account: FormView['accounts'][number]): SelectOption => ({
    value: account.id,
    label: account.archived ? `${account.name} · ${t('accounts.archivedBadge')}` : account.name,
    icon: account.icon as IconName,
    colorIndex: account.colorIndex,
    hint: money(account.balanceNow),
  });
  const accountOptions = view.accounts.map(accountOption);
  // An expense or an income never sits on a pocket (§5.14), bar the one the edited row uses.
  const flowAccountOptions = accountsFor(view, values.kind).map(accountOption);

  const message = (current: NonNullable<Problem>) =>
    'missing' in current
      ? t(`txForm.missing_${current.missing}`, { available: money(preview.from?.now ?? 0) })
      : t(`web.form.error_${current.error}`);
  const invalid = (field: string) =>
    problem !== null && 'missing' in problem && FIELD_OF[problem.missing] === field;

  const focusField = (field: string) => {
    const target = form.current?.querySelector<HTMLElement>(
      `[data-field="${field}"] input, [data-field="${field}"] button`,
    );
    target?.focus();
  };

  const save = () => {
    if (pending) return;
    const gap = missingForSave(values, minorDigits, overdrawn);
    if (gap !== null) {
      setProblem({ missing: gap });
      focusField(FIELD_OF[gap]);
      return;
    }
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof saveTransactionAction>>;
      try {
        result = await saveTransactionAction({
          id: view.id,
          kind: values.kind,
          buffer: values.buffer,
          date: values.date,
          accountId: values.accountId,
          toAccountId: transfer ? values.toAccountId : null,
          categoryId: transfer ? null : values.categoryId,
          description: values.description,
          tagIds: values.tagIds,
          excludeFromTotals: values.excludeFromTotals,
          closeGoalId: view.closeGoalId,
        });
      } catch {
        // A thrown action (the network, the server) keeps the draft and says so.
        setProblem({ error: 'unexpected' });
        return;
      }
      if (result.ok) {
        // `replace`: Back from the saved row goes where the form was opened from, not into the form.
        router.replace(afterSave.replace('__ID__', encodeURIComponent(result.id)));
        router.refresh();
        return;
      }
      if ('missing' in result) {
        setProblem({ missing: result.missing });
        focusField(FIELD_OF[result.missing]);
      } else {
        setProblem({ error: result.error });
      }
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
      return;
    }
    // In a field Esc leaves the field; the next Esc closes the panel (`Panel` skips editable targets).
    if (
      event.key === 'Escape' &&
      (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
    ) {
      event.target.blur();
    }
  };

  const addTag = (id: string) => {
    set({ tagIds: [...values.tagIds, id] });
    setTagQuery('');
  };

  const createTag = (name: string) => {
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof createTagAction>>;
      try {
        result = await createTagAction(name);
      } catch {
        setProblem({ error: 'unexpected' });
        return;
      }
      if (!result.ok) {
        setProblem({ error: result.error });
        return;
      }
      setTags((current) =>
        current.some((tag) => tag.id === result.tag.id) ? current : [...current, result.tag],
      );
      setValues((current) =>
        current.tagIds.includes(result.tag.id)
          ? current
          : { ...current, tagIds: [...current.tagIds, result.tag.id] },
      );
      setTagQuery('');
    });
  };

  // Enter in the tag field picks a tag instead of submitting the form.
  const onTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    const first = suggestions[0];
    if (first !== undefined && tagQuery.trim() !== '') addTag(first.id);
    else if (creatable) createTag(tagQuery.trim());
  };

  const balanceNote =
    preview.from === null
      ? null
      : preview.from.now === preview.from.after
        ? t('txForm.balanceNow', { now: money(preview.from.now) })
        : t('txForm.balanceAfter', {
            now: money(preview.from.now),
            after: money(preview.from.after),
          });

  const placeholder = minorDigits === 0 ? '0' : `0${decimalSeparator}${'0'.repeat(minorDigits)}`;
  const tagName = (id: string) => tags.find((tag) => tag.id === id)?.name ?? id;

  return (
    <form
      className={styles.form}
      ref={form}
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      noValidate
      // N, E and ↑ ↓ do nothing while the form is open, even with the focus on the page (`ignoresShortcut`).
      data-owns-keys=""
    >
      {/* The panel's own heading already names the form; this is its visible title. */}
      <p className={styles.title} aria-hidden="true">
        {t(view.mode === 'new' ? 'txForm.newTitle' : 'txForm.editTitle')}
      </p>

      <Segmented
        label={t('web.form.kind')}
        value={values.kind}
        options={KINDS.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) }))}
        onChange={(kind) => {
          setValues((current) => changeKind(current, kind));
          setProblem(null);
          setAllCategories(false);
        }}
      />

      <div data-field="amount">
        <AmountField
          label={t('txForm.amount')}
          buffer={values.buffer}
          onChange={(buffer) => set({ buffer })}
          minorDigits={minorDigits}
          decimalSeparator={decimalSeparator}
          sign={values.kind === 'expense' ? '−' : values.kind === 'income' ? '+' : ''}
          symbol={symbol}
          symbolPosition={symbolPosition}
          placeholder={placeholder}
          autoFocus={view.mode === 'new'}
          invalid={invalid('amount')}
        />
      </div>

      {transfer ? (
        <div className={styles.transfer}>
          <div className={styles.pair}>
            <div data-field="account">
              <Select
                label={t('txForm.from')}
                hintInTrigger={false}
                value={values.accountId}
                options={accountOptions}
                onChange={(accountId) => set({ accountId })}
                placeholder={t('txForm.from')}
                invalid={invalid('account')}
              />
            </div>
            <button
              type="button"
              className={styles.swap}
              aria-label={t('web.form.swap')}
              onClick={() => set({ accountId: values.toAccountId, toAccountId: values.accountId })}
            >
              <Icon name="swap" size={16} />
            </button>
            <div data-field="destination">
              <Select
                label={t('txForm.to')}
                hintInTrigger={false}
                value={values.toAccountId}
                options={accountOptions}
                onChange={(toAccountId) => set({ toAccountId })}
                placeholder={t('txForm.to')}
                invalid={invalid('destination')}
              />
            </div>
          </div>
          {balanceNote === null ? null : <p className={styles.faintNote}>{balanceNote}</p>}
          {overdrawn ? (
            <p className={styles.warning}>
              {t('txForm.missing_insufficientFunds', {
                available: money(preview.from?.now ?? 0),
              })}
            </p>
          ) : null}
          {overpays ? (
            <p className={styles.warning}>
              {t('txForm.cardInCredit', { amount: money(preview.to?.after ?? 0) })}
            </p>
          ) : null}
          {fills.length === 0 ? null : (
            <div className={styles.quick}>
              {fills.map((fill) => (
                <button
                  key={fill.key}
                  type="button"
                  className={styles.chip}
                  aria-pressed={amount === fill.minor}
                  onClick={() => set({ buffer: minorToAmountBuffer(fill.minor, minorDigits) })}
                >
                  {t(fill.key === 'balance' ? 'txForm.fillBalance' : 'txForm.fillMissing', {
                    amount: money(fill.minor),
                  })}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <TextField
            label={t(
              values.kind === 'income' ? 'txForm.descriptionIncome' : 'txForm.descriptionExpense',
            )}
            placeholder={t('web.form.descriptionPlaceholder')}
            value={values.description}
            maxLength={120}
            autoComplete="off"
            onChange={(event) => set({ description: event.target.value })}
          />

          <fieldset className={styles.field} data-field="category">
            <legend className={styles.label}>
              {t('txForm.category')} · {t('txForm.categoryMostUsed').toLocaleLowerCase(locale)}
            </legend>
            {categories.length === 0 ? (
              <p className={styles.faintNote}>{t('web.form.noCategories')}</p>
            ) : (
              <>
                {tiles.length === 0 ? null : (
                  <div className={styles.cats}>
                    {tiles.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        className={styles.cat}
                        aria-pressed={values.categoryId === category.id}
                        onClick={() => set({ categoryId: category.id })}
                      >
                        <IconBox
                          name={category.icon as IconName}
                          colorIndex={category.colorIndex}
                        />
                        <span className={styles.catName}>{category.name}</span>
                        {category.archived ? (
                          <span className={styles.catNote}>{t('categories.archivedBadge')}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}
                {allCategories ? (
                  <Select
                    label={t('txForm.allCategories')}
                    value={values.categoryId}
                    defaultOpen
                    options={categories.map((category) => ({
                      value: category.id,
                      label: `${category.child ? `— ${category.name}` : category.name}${
                        category.archived ? ` · ${t('categories.archivedBadge')}` : ''
                      }`,
                      icon: category.icon as IconName,
                      colorIndex: category.colorIndex,
                    }))}
                    onChange={(categoryId) => {
                      set({ categoryId });
                      setAllCategories(false);
                    }}
                    placeholder={t('txForm.category')}
                    invalid={invalid('category')}
                  />
                ) : (
                  <button
                    type="button"
                    className={styles.linkish}
                    onClick={() => setAllCategories(true)}
                  >
                    {t('txForm.allCategories')}
                  </button>
                )}
              </>
            )}
          </fieldset>
        </>
      )}

      <div className={styles.two}>
        {transfer ? null : (
          <div data-field="account">
            {flowAccountOptions.length === 0 ? (
              <p className={styles.faintNote}>{t('web.form.noAccounts')}</p>
            ) : (
              <Select
                label={t('txForm.account')}
                value={values.accountId}
                options={flowAccountOptions}
                onChange={(accountId) => set({ accountId })}
                placeholder={t('txForm.account')}
                invalid={invalid('account')}
              />
            )}
          </div>
        )}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="tx-date">
            {t('txForm.date')}
          </label>
          <input
            id="tx-date"
            className={styles.input}
            type="date"
            value={values.date}
            required
            onChange={(event) => {
              // Clearing a native date field hands back ''; a transaction always has a day.
              if (event.target.value !== '') set({ date: event.target.value });
            }}
          />
          <div className={styles.quick}>
            {dateChoices(today).map((choice) => (
              <button
                key={choice.key}
                type="button"
                className={`${styles.chip} ${styles.small}`}
                aria-pressed={values.date === choice.date}
                onClick={() => set({ date: choice.date })}
              >
                {t(`txForm.${choice.key}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className={styles.separator}>{t('txForm.details')}</p>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="tx-tags">
          {t('transactions.tags')}
        </label>
        <div className={styles.tagBox}>
          {values.tagIds.map((id) => (
            <span className={styles.pill} key={id}>
              #{tagName(id)}
              <button
                type="button"
                className={styles.pillRemove}
                aria-label={t('web.form.removeTag', { name: tagName(id) })}
                onClick={() => set({ tagIds: values.tagIds.filter((tagId) => tagId !== id) })}
              >
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
          <input
            id="tx-tags"
            className={styles.tagInput}
            value={tagQuery}
            placeholder={t('txForm.tagsPlaceholder')}
            autoComplete="off"
            maxLength={40}
            onChange={(event) => setTagQuery(event.target.value)}
            onKeyDown={onTagKeyDown}
            onFocus={() => setTagsOpen(true)}
          />
        </div>
        {tagsOpen && (suggestions.length > 0 || creatable) ? (
          // A pick with the pointer keeps the focus in the field (`onMouseDown`), so typing goes on.
          <div className={styles.suggestions}>
            {suggestions.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={styles.chip}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addTag(tag.id)}
              >
                #{tag.name}
              </button>
            ))}
            {creatable ? (
              <button
                type="button"
                className={styles.chip}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => createTag(tagQuery.trim())}
              >
                <Icon name="plus" size={14} />
                {t('txForm.createTag', { name: tagQuery.trim() })}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <Switch
        label={t('txForm.exclude')}
        note={t('txForm.excludeNote')}
        checked={values.excludeFromTotals}
        onChange={(excludeFromTotals) => set({ excludeFromTotals })}
      />

      <div className={styles.repeat}>
        <div className={styles.repeatText}>
          <span>{t('txForm.repeat')}</span>
          <span className={styles.faintNote}>{t('web.form.repeatOnPhone')}</span>
        </div>
        <span className={styles.repeatValue}>
          {t(view.recurring ? 'web.form.repeatRecurring' : 'web.form.repeatNever')}
        </span>
      </div>

      {problem === null ? null : <Alert body={message(problem)} />}

      <div className={styles.foot}>
        <span className={styles.hint}>{t('web.form.keyboardHint')}</span>
        <Link className={styles.cancel} href={closeHref}>
          {t('common.cancel')}
        </Link>
        <div>
          <Button type="submit" busy={pending} busyLabel={t('common.loading')}>
            {t(view.mode === 'new' ? 'txForm.create' : 'txForm.save')}
          </Button>
        </div>
      </div>
    </form>
  );
}
