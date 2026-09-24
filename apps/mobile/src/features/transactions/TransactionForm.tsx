import {
  accountChoices,
  amountBufferToMinor,
  type BalancePreview,
  getCurrency,
  minorToAmountBuffer,
  topCategories,
  transferBalancePreview,
  transferOverdrawsSource,
  transferOverpaysCard,
} from '@saldo/core';
import { formatDayMonth, formatLongDate } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { AmountInput } from '../../components/AmountInput';
import { AmountText } from '../../components/AmountText';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { DateSheet } from '../../components/DateSheet';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Segmented } from '../../components/Segmented';
import { TextField } from '../../components/TextField';
import { Toggle } from '../../components/Toggle';
import { useRepositories } from '../../db/DatabaseProvider';
import {
  useAccounts,
  useAttachments,
  useCategories,
  useRecurrence,
  useSettings,
  useTags,
  useTransactionsInRange,
} from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { useHiddenMoney } from '../hidden/hiddenAmounts';
import { AmountChoice } from './AmountChoice';
import { AttachmentStrip } from './AttachmentStrip';
import { CategoryPickerSheet } from './CategoryPickerSheet';
import { RecurrenceSheet } from './RecurrenceSheet';
import { cadenceLabel, endLabel, presetOf, ruleForPreset } from './recurrenceCopy';
import {
  canCreateTag,
  changeKind,
  dateChoices,
  detailsOpenInitially,
  detailsSummary,
  missingForSave,
  type TransactionFormValues,
  tagSuggestions,
} from './useTransactionForm';

export interface TransactionFormProps {
  /** Captured once by the caller so every screen agrees on the calendar day (§3.2). */
  today: string;
  /**
   * The id the transaction has or will have. Attachments need it before the row exists, so a new
   * transaction gets its id from the screen rather than from the repository (§10).
   */
  transactionId: string;
  values: TransactionFormValues;
  onChange: (values: TransactionFormValues) => void;
  /** Edit mode opens with the keypad closed and a full-width save button (§6.16). */
  mode: 'new' | 'edit';
  onSubmit: () => void;
  onDelete?: () => void;
  submitting?: boolean;
  /**
   * Set when editing an occurrence: the rule is shown read-only and "Gestisci" opens the
   * recurrence, because a rule change is a change to the whole series, not to this row (§5.9).
   */
  recurrenceId?: string | null;
  /**
   * One-tap amounts under the field — "Salda carta" offers the closed statement and the whole
   * balance. A chip reads as chosen while the field holds its amount.
   */
  amountShortcuts?: readonly { key: string; label: string; minor: number }[];
  /** The closing expense of a goal (§6.38): an expense and nothing else, so no kind switch. */
  lockKind?: boolean;
}

const KINDS = ['expense', 'income', 'transfer'] as const;
/** Four tiles per row with an 8px gap, as in the design's grid. */
const TILE_WIDTH = '22.5%';

export function TransactionForm({
  today,
  transactionId,
  values,
  onChange,
  mode,
  onSubmit,
  onDelete,
  submitting = false,
  recurrenceId = null,
  amountShortcuts = [],
  lockKind = false,
}: TransactionFormProps) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  // What the keypad scrolls clear of itself: the whole amount card, not only the figure.
  const amountCard = useRef<View>(null);
  const { format: money } = useHiddenMoney();
  const locale = useAppLocale();
  const repos = useRepositories();
  const settings = useSettings();
  const accounts = useAccounts();
  const categories = useCategories();
  const tags = useTags();
  const currency = settings?.currency ?? 'EUR';
  const { minorDigits } = getCurrency(currency);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [recurrenceSheetOpen, setRecurrenceSheetOpen] = useState(false);
  const occurrenceOf = useRecurrence(recurrenceId ?? '');
  const [tagQuery, setTagQuery] = useState('');
  const attachments = useAttachments(transactionId);
  const summary = detailsSummary(values, attachments.length);
  // Only the initial state: after the first tap the user's choice wins, not the data's.
  const [detailsOpen, setDetailsOpen] = useState(() => detailsOpenInitially(mode, summary));

  // One read serves three questions, each of which cuts a different slice from it: what the
  // accounts hold today, which tags this transaction's own past suggests, and which categories are
  // in current use. A back-dated transaction still needs today's balances and a future-dated one
  // still needs its own, so the query covers the later of the two.
  const history = useTransactionsInRange('1970-01-01', values.date > today ? values.date : today);
  // Capped at the transaction's date: a suggestion drawn from rows the transaction predates would
  // be a suggestion from its future.
  const recent = useMemo(
    () => history.filter((tx) => tx.date <= values.date),
    [history, values.date],
  );
  // Capped at today instead, because the category tiles are ranked on a window that ends today.
  // Cutting at `values.date` as well would leave a receipt typed up three months late with an
  // empty window and no recents at all, when what it wants is exactly the ones in current use.
  const upToToday = useMemo(() => history.filter((tx) => tx.date <= today), [history, today]);

  // §6.16: "have I got the money there" is the question a transfer asks, and the balances live one
  // screen away. Only for transfers — an expense form that priced every account would be noise.
  const transferPreview = useMemo(
    () =>
      values.kind === 'transfer'
        ? transferBalancePreview(accounts, history, today, {
            id: transactionId,
            amount: amountBufferToMinor(values.buffer, minorDigits),
            date: values.date,
            fromAccountId: values.accountId,
            toAccountId: values.toAccountId,
          })
        : { from: null, to: null },
    [
      accounts,
      history,
      today,
      transactionId,
      minorDigits,
      values.kind,
      values.buffer,
      values.date,
      values.accountId,
      values.toAccountId,
    ],
  );
  // Seven plus the "Altro" tile is two rows: the grid stops being the whole screen, and what it
  // pushed below the fold — the tags, the attachments — is reachable without scrolling past it.
  // Ranked on `upToToday`, not on `recent`: what the thumb reaches for is the same whether the
  // receipt being typed up is from this morning or from last month.
  const grid = useMemo(
    () => topCategories(categories, upToToday, values.kind, { today }),
    [categories, upToToday, values.kind, today],
  );
  // A category chosen from the full list is not in the grid, so the grid grows to hold it rather
  // than showing nothing selected.
  const selectedOutsideGrid = useMemo(
    () =>
      values.categoryId === null || grid.some((category) => category.id === values.categoryId)
        ? null
        : (categories.find((category) => category.id === values.categoryId) ?? null),
    [categories, grid, values.categoryId],
  );
  const tiles = selectedOutsideGrid === null ? grid : [selectedOutsideGrid, ...grid.slice(0, 6)];
  const suggestions = useMemo(
    () => tagSuggestions(tags, recent, tagQuery, values.tagIds),
    [tags, recent, tagQuery, values.tagIds],
  );

  const liveAccounts = accounts.filter((account) => account.archivedAt === null);
  // A transfer may not take out more than the source holds. The archived accounts are in `accounts`
  // on purpose: an account can be archived while a transaction out of it is still open for editing.
  const overdrawn = transferOverdrawsSource(
    accounts.find((account) => account.id === values.accountId),
    transferPreview.from,
  );
  const missing = missingForSave(values, minorDigits, overdrawn);
  // The other end of the same check: paying a card past zero is allowed (a refund or an
  // overpayment does that for real), so it is a line to read, never a disabled button.
  const overpays = transferOverpaysCard(
    accounts.find((account) => account.id === values.toAccountId),
    transferPreview.to,
  );
  const typed = amountBufferToMinor(values.buffer, minorDigits);
  const ready = missing === null;

  const set = (patch: Partial<TransactionFormValues>) => onChange({ ...values, ...patch });
  // The rule the two named chips cannot show — the fourth chip wears its label instead of "Altro".
  const otherRule =
    values.recurrence !== null && !['monthly', 'weekly'].includes(presetOf(values.recurrence))
      ? values.recurrence
      : null;

  const summaryParts = [
    summary.tags > 0 ? t('txForm.detailsTags', { count: summary.tags }) : null,
    summary.attachments > 0 ? t('txForm.detailsAttachments', { count: summary.attachments }) : null,
    summary.excludeFromTotals ? t('txForm.exclude') : null,
  ].filter((part): part is string => part !== null);
  const summaryLabel =
    summaryParts.length === 0 ? t('txForm.detailsNone') : summaryParts.join(' · ');

  // Through hidden mode too: this label is spoken aloud, which is exactly what hiding is for.
  const spoken = (minor: number) => money(minor, currency, locale);

  /**
   * The chosen account's balance, and what this transfer leaves it at. The arrow appears only when
   * the draft actually moves something: an incomplete pair or a future date prints one figure, so
   * the line never shows the same number twice.
   */
  const balanceLine = (preview: BalancePreview) => {
    const changes = preview.after !== preview.now;
    return (
      <View
        accessible
        accessibilityLabel={
          changes
            ? t('txForm.balanceAfter', { now: spoken(preview.now), after: spoken(preview.after) })
            : t('txForm.balanceNow', { now: spoken(preview.now) })
        }
        style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
      >
        <Text size="caption" color="textFaint">
          {t('txForm.balance')}
        </Text>
        <AmountText
          size="caption"
          color={changes ? 'textFaint' : 'textMuted'}
          minor={preview.now}
          currency={currency}
          locale={locale}
        />
        {changes ? (
          <>
            <Icon name="chevR" size={11} color={theme.palette.textFaint} />
            <AmountText
              size="caption"
              color="textMuted"
              minor={preview.after}
              currency={currency}
              locale={locale}
            />
          </>
        ) : null}
      </View>
    );
  };

  const accountRow = (
    label: string,
    selectedId: string | null,
    onSelect: (id: string) => void,
    preview: BalancePreview | null = null,
  ) => (
    <View style={{ gap: 6 }}>
      <Text size="footnote" color="textMuted">
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
      >
        {accountChoices(liveAccounts, {
          // Money reaches a pocket by transfer only (§5.14); an expense from one arrives
          // pre-selected when a goal is closed.
          includePockets: values.kind === 'transfer',
          keepId: selectedId,
        }).map((account, index) => (
          <Chip
            key={account.id}
            // By position, as the category tiles: the end-to-end flows need *an* account.
            testID={`txform-account-${index}`}
            label={account.name}
            active={account.id === selectedId}
            onPress={() => onSelect(account.id)}
          />
        ))}
      </ScrollView>
      {preview === null ? null : balanceLine(preview)}
    </View>
  );

  return (
    <Screen
      // Presented as a sheet, so the top inset belongs to the card behind it, not to this screen.
      sheet
      footer={
        <View style={{ gap: 8 }}>
          {missing === null ? null : (
            // Not an error — nothing is wrong yet — so it is a muted line, not a red one. It names
            // the next thing to fix rather than listing everything that is unfinished.
            //
            // Shown from the first render, with no "has the user typed yet" gate: every form in the
            // app follows the one rule that a disabled button is never silent, and an untouched form
            // is exactly when the button is greyest and the reason least guessable.
            <Text size="footnote" color="textMuted">
              {t(`txForm.missing_${missing}`, {
                available: spoken(transferPreview.from?.now ?? 0),
              })}
            </Text>
          )}
          {values.recurrence !== null && occurrenceOf === null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="repeat" size={12} color={theme.palette.textMuted} />
              <Text size="caption" color="textMuted">
                {t('recurrence.createsUpcoming')}
              </Text>
            </View>
          ) : null}
          <PrimaryButton
            testID="txform-submit"
            label={mode === 'new' ? t('txForm.create') : t('txForm.save')}
            disabled={!ready}
            loading={submitting}
            onPress={onSubmit}
          />
          {onDelete === undefined ? null : (
            <SecondaryButton label={t('common.delete')} onPress={onDelete} />
          )}
        </View>
      }
    >
      {/* Presented as a sheet (see `app/_layout.tsx`), so it closes rather than goes back. */}
      <ScreenHeader
        backIcon="x"
        title={mode === 'new' ? t('txForm.newTitle') : t('txForm.editTitle')}
      />

      {lockKind ? null : (
        <Segmented
          accessibilityLabel={t('txForm.amount')}
          options={KINDS.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) }))}
          value={values.kind}
          onChange={(kind) => onChange(changeKind(values, kind))}
        />
      )}

      {/* The keypad clears the whole card, not just the figure: the choice, the custom-amount
          line and the overpay warning under it are all about the amount being typed. */}
      <Card ref={amountCard}>
        <Text size="footnote" color="textMuted">
          {t('txForm.amount')}
        </Text>
        <View style={{ marginTop: 6 }}>
          <AmountInput
            testID="txform-amount"
            keypadRevealRef={amountCard}
            buffer={values.buffer}
            onChange={(buffer: string) => set({ buffer })}
            currency={currency}
            locale={locale}
            autoFocus={mode === 'new'}
            label={t('txForm.amount')}
            doneLabel={t('common.done')}
          />
        </View>
        {amountShortcuts.length === 0 ? null : (
          <>
            <AmountChoice
              accessibilityLabel={t('txForm.amount')}
              options={amountShortcuts.map((shortcut) => ({
                ...shortcut,
                amount: spoken(shortcut.minor),
              }))}
              value={amountShortcuts.find((shortcut) => shortcut.minor === typed)?.key ?? null}
              onSelect={(option) => set({ buffer: minorToAmountBuffer(option.minor, minorDigits) })}
            />
            {amountShortcuts.some((shortcut) => shortcut.minor === typed) ? null : (
              // The state a segmented control does not have: the field holds neither figure, and
              // the thumb has faded away, so the line says what is on screen.
              <Text size="footnote" color="textMuted" style={{ marginTop: 8 }}>
                {t('txForm.customAmount')}
              </Text>
            )}
          </>
        )}
        {overpays ? (
          // Next to its cause rather than in the footer: it is about the amount, and it never
          // blocks save.
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10 }}>
            <View style={{ marginTop: 1 }}>
              <Icon name="info" size={14} color={theme.palette.textMuted} />
            </View>
            <Text size="footnote" color="textMuted" style={{ flex: 1 }}>
              {t('txForm.cardInCredit', { amount: spoken(transferPreview.to?.after ?? 0) })}
            </Text>
          </View>
        ) : null}
      </Card>

      <Card>
        <View style={{ gap: 14 }}>
          {values.kind === 'transfer' ? (
            <>
              {accountRow(
                t('txForm.from'),
                values.accountId,
                (id) => set({ accountId: id }),
                transferPreview.from,
              )}
              {accountRow(
                t('txForm.to'),
                values.toAccountId,
                (id) => set({ toAccountId: id }),
                transferPreview.to,
              )}
            </>
          ) : (
            accountRow(t('txForm.account'), values.accountId, (id) => set({ accountId: id }))
          )}
          <View style={{ gap: 6 }}>
            <Text size="footnote" color="textMuted">
              {t('txForm.date')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              {dateChoices(today).map((choice) => (
                <Chip
                  key={choice.key}
                  label={t(`txForm.${choice.key}`)}
                  active={values.date === choice.date}
                  onPress={() => set({ date: choice.date })}
                />
              ))}
              <Chip
                // Short next to the two shortcut chips, which is all the row has space for; the
                // year appears only when it is not the current one, and the full date is what
                // gets announced.
                label={
                  values.date.slice(0, 4) === today.slice(0, 4)
                    ? formatDayMonth(values.date, locale)
                    : formatLongDate(values.date, locale)
                }
                accessibilityLabel={formatLongDate(values.date, locale)}
                icon="cal"
                active={!dateChoices(today).some((choice) => choice.date === values.date)}
                onPress={() => setDatePickerOpen(true)}
                chevron
              />
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text size="footnote" color="textMuted">
              {t('txForm.repeat')}
            </Text>
            {occurrenceOf !== null ? (
              <Pressable
                testID="txform-recurrence-manage"
                accessibilityRole="button"
                accessibilityLabel={t('recurrence.manage')}
                onPress={() =>
                  router.push({ pathname: '/recurrence/[id]', params: { id: occurrenceOf.id } })
                }
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: theme.layout.minHitTarget,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Icon name="repeat" size={14} color={theme.palette.textMuted} />
                <Text style={{ flex: 1 }} numberOfLines={1}>
                  {cadenceLabel(occurrenceOf, occurrenceOf.startDate, t, locale)} ·{' '}
                  {endLabel(occurrenceOf.endDate, t, locale)}
                </Text>
                <Text size="footnote" color="textMuted">
                  {t('recurrence.manage')}
                </Text>
                <Icon name="chevR" size={16} color={theme.palette.textFaint} />
              </Pressable>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0, flexShrink: 0 }}
                  contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
                >
                  <Chip
                    testID="txform-repeat-never"
                    label={t('recurrence.never')}
                    active={values.recurrence === null}
                    onPress={() => set({ recurrence: null })}
                  />
                  <Chip
                    testID="txform-repeat-monthly"
                    label={t('recurrence.everyMonth')}
                    active={presetOf(values.recurrence) === 'monthly'}
                    onPress={() =>
                      set({
                        recurrence: ruleForPreset('monthly', values.recurrence?.endDate ?? null),
                      })
                    }
                  />
                  <Chip
                    testID="txform-repeat-weekly"
                    label={t('recurrence.everyWeek')}
                    active={presetOf(values.recurrence) === 'weekly'}
                    onPress={() =>
                      set({
                        recurrence: ruleForPreset('weekly', values.recurrence?.endDate ?? null),
                      })
                    }
                  />
                  <Chip
                    testID="txform-repeat-other"
                    label={
                      otherRule
                        ? cadenceLabel(otherRule, values.date, t, locale)
                        : t('recurrence.other')
                    }
                    icon="repeat"
                    chevron
                    active={otherRule !== null}
                    onPress={() => setRecurrenceSheetOpen(true)}
                  />
                </ScrollView>
                {values.recurrence === null ? null : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('recurrence.change')}
                    onPress={() => setRecurrenceSheetOpen(true)}
                    hitSlop={6}
                    style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}
                  >
                    <Text
                      size="caption"
                      color="textFaint"
                      numberOfLines={1}
                      style={{ flexShrink: 1 }}
                    >
                      {cadenceLabel(values.recurrence, values.date, t, locale)} ·{' '}
                      {endLabel(values.recurrence.endDate, t, locale)}
                    </Text>
                    <Text
                      size="caption"
                      color="textMuted"
                      style={{ textDecorationLine: 'underline' }}
                    >
                      {t('recurrence.change')}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      </Card>

      {values.kind === 'transfer' ? null : (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text size="footnote" color="textMuted" style={{ flex: 1 }}>
              {t('txForm.category')}
            </Text>
            <Text size="caption" color="textFaint">
              {t('txForm.categoryMostUsed')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {tiles.map((category, index) => {
              const selected = category.id === values.categoryId;
              const colour = theme.categoryColor(category.colorIndex);
              return (
                <Pressable
                  key={category.id}
                  // By position, not by id: the ids are random, and the end-to-end flows in
                  // `apps/mobile/maestro` need *a* category rather than a particular one.
                  testID={`txform-category-${index}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={category.name}
                  onPress={() => set({ categoryId: category.id })}
                  style={({ pressed }) => ({
                    width: TILE_WIDTH,
                    alignItems: 'center',
                    gap: 5,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  })}
                >
                  <View
                    style={{
                      width: '100%',
                      height: 52,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: theme.radii.input,
                      borderWidth: 1,
                      borderColor: selected ? theme.palette.borderStrong : theme.palette.border,
                      backgroundColor: selected ? theme.tint(colour, 0.18) : theme.palette.raised,
                    }}
                  >
                    <Icon
                      name={category.icon as IconName}
                      size={18}
                      color={selected ? colour : theme.palette.textMuted}
                    />
                  </View>
                  <Text
                    size="caption"
                    numberOfLines={1}
                    color={selected ? 'text' : 'textMuted'}
                    style={{ textAlign: 'center' }}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('txForm.otherCategory')}
              onPress={() => setPickerOpen(true)}
              style={({ pressed }) => ({
                width: TILE_WIDTH,
                alignItems: 'center',
                gap: 5,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}
            >
              <View
                style={{
                  width: '100%',
                  height: 52,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: theme.radii.input,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: theme.palette.border,
                }}
              >
                <Icon name="grip" size={18} color={theme.palette.textMuted} />
              </View>
              <Text size="caption" color="textMuted" numberOfLines={1}>
                {t('txForm.otherCategory')}
              </Text>
            </Pressable>
          </View>
        </Card>
      )}

      <Card>
        <TextField
          testID="txform-description"
          label={t('txForm.description')}
          placeholder={
            values.kind === 'income'
              ? t('txForm.descriptionIncome')
              : t('txForm.descriptionExpense')
          }
          value={values.description}
          onChangeText={(description) => set({ description })}
        />
      </Card>

      {/*
        The four fields below are the ones that are rarely touched, and together they were ~340pt
        of form under the fold — on `new`, with the keypad up, everything from the category grid
        down was invisible at the moment the form opened. Collapsed, the frequent fields fit in one
        screen; the summary line is what keeps a collapsed field from becoming an invisible one.
      */}
      <Card>
        <Pressable
          testID="txform-details"
          accessibilityRole="button"
          accessibilityState={{ expanded: detailsOpen }}
          accessibilityLabel={t('txForm.details')}
          accessibilityHint={summaryLabel}
          onPress={() => setDetailsOpen(!detailsOpen)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            minHeight: theme.layout.minHitTarget,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text>{t('txForm.details')}</Text>
            <Text size="footnote" color="textMuted" numberOfLines={1}>
              {summaryLabel}
            </Text>
          </View>
          {/* One icon, rotated per state, rather than two assets. */}
          <View style={{ transform: [{ rotate: detailsOpen ? '180deg' : '0deg' }] }}>
            <Icon name="chevD" size={16} color={theme.palette.textFaint} />
          </View>
        </Pressable>

        {detailsOpen ? (
          <View style={{ gap: 14, marginTop: 14 }}>
            <View style={{ gap: 10 }}>
              <TextField
                label={t('transactions.tags')}
                placeholder={t('txForm.tagsPlaceholder')}
                value={tagQuery}
                onChangeText={setTagQuery}
              />
              {/* One wrapping row: the chosen tags first, then the suggestions. Two rows put a
                  chip that was just picked on a line of its own, away from where it was tapped. */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {values.tagIds.map((id) => {
                  const tag = tags.find((candidate) => candidate.id === id);
                  return (
                    <Chip
                      key={id}
                      label={tag?.name ?? id}
                      active
                      onPress={() => set({ tagIds: values.tagIds.filter((value) => value !== id) })}
                    />
                  );
                })}
                {suggestions.map((tag) => (
                  <Chip
                    key={tag.id}
                    label={tag.name}
                    onPress={() => {
                      set({ tagIds: [...values.tagIds, tag.id] });
                      setTagQuery('');
                    }}
                  />
                ))}
                {canCreateTag(tags, tagQuery) ? (
                  <Chip
                    label={t('txForm.createTag', { name: tagQuery.trim() })}
                    onPress={() => {
                      const created = repos.tags.create({ name: tagQuery.trim() });
                      set({ tagIds: [...values.tagIds, created.id] });
                      setTagQuery('');
                    }}
                  />
                ) : null}
              </View>
            </View>

            <AttachmentStrip transactionId={transactionId} />

            <View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text>{t('txForm.exclude')}</Text>
                <Toggle
                  value={values.excludeFromTotals}
                  onChange={(excludeFromTotals) => set({ excludeFromTotals })}
                  accessibilityLabel={t('txForm.exclude')}
                />
              </View>
              <Text size="caption" color="textFaint" style={{ marginTop: 4 }}>
                {t('txForm.excludeNote')}
              </Text>
            </View>
          </View>
        ) : null}
      </Card>

      <RecurrenceSheet
        visible={recurrenceSheetOpen}
        onClose={() => setRecurrenceSheetOpen(false)}
        value={values.recurrence}
        startDate={values.date}
        today={today}
        onChange={(recurrence) => set({ recurrence })}
      />

      <DateSheet
        visible={datePickerOpen}
        value={values.date}
        today={today}
        onSelect={(date) => set({ date })}
        onClose={() => setDatePickerOpen(false)}
      />

      <CategoryPickerSheet
        visible={pickerOpen}
        categories={categories}
        kind={values.kind}
        selectedId={values.categoryId}
        onSelect={(categoryId) => set({ categoryId })}
        onClose={() => setPickerOpen(false)}
      />
    </Screen>
  );
}
