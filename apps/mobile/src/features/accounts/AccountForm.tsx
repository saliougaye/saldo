import {
  type Account,
  amountBufferToMinor,
  minorToAmountBuffer,
  openingBalanceForCurrent,
  paymentAccountCandidates,
} from '@saldo/core';
import { accountIconOptions, type IconName } from '@saldo/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AmountInput } from '../../components/AmountInput';
import { AppearanceSheet } from '../../components/AppearanceSheet';
import { PrimaryButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { DayOfMonthSheet } from '../../components/DayOfMonthSheet';
import { IconBox, ListRow } from '../../components/ListRow';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TextField } from '../../components/TextField';
import { Toggle } from '../../components/Toggle';
import { useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { AccountTypeSheet } from './AccountTypeSheet';
import { PaymentAccountSheet } from './PaymentAccountSheet';

export interface AccountFormValues {
  name: string;
  institution: string;
  type: Account['type'];
  /** Keypad buffer of the **current** balance, not the opening one (§6.22). */
  buffer: string;
  includeInSpendable: boolean;
  colorIndex: number;
  icon: IconName;
  creditCloseDay: number | null;
  creditChargeDay: number | null;
  /** Credit cards only: the account the card is charged to (§4, §6.22). */
  creditPaymentAccountId: string | null;
}

export function emptyAccountForm(): AccountFormValues {
  return {
    name: '',
    institution: '',
    type: 'checking',
    buffer: '',
    includeInSpendable: true,
    colorIndex: 0,
    icon: 'landmark',
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
  };
}

export function accountFormFrom(
  account: Account,
  currentBalance: number,
  minorDigits: 0 | 2 | 3,
): AccountFormValues {
  return {
    name: account.name,
    institution: account.institution ?? '',
    type: account.type,
    buffer: minorToAmountBuffer(currentBalance, minorDigits),
    includeInSpendable: account.includeInSpendable,
    colorIndex: account.colorIndex,
    icon: account.icon as IconName,
    creditCloseDay: account.creditCloseDay,
    creditChargeDay: account.creditChargeDay,
    creditPaymentAccountId: account.creditPaymentAccountId,
  };
}

/**
 * The opening balance to store for what the user typed (§6.22). In edit mode the amount is the
 * *current* balance, so it has to be turned back into an opening balance.
 */
export function openingBalanceFrom(
  values: AccountFormValues,
  minorDigits: 0 | 2 | 3,
  context: {
    accountId: string | null;
    txs: Parameters<typeof openingBalanceForCurrent>[0]['txs'];
    today: string;
  },
): number {
  const current = amountBufferToMinor(values.buffer, minorDigits);
  if (context.accountId === null) return current;
  return openingBalanceForCurrent({
    accountId: context.accountId,
    currentBalance: current,
    txs: context.txs,
    today: context.today,
  });
}

/**
 * What the form is still waiting for, or `null` when nothing is. The name is the only thing an
 * account cannot be saved without (§6.22) — a balance of zero is a balance — so the footer names it
 * rather than leaving the button grey and unexplained.
 */
export function accountMissingForSave(values: AccountFormValues): 'name' | null {
  return values.name.trim().length > 0 ? null : 'name';
}

export interface AccountFormProps {
  values: AccountFormValues;
  onChange: (values: AccountFormValues) => void;
  mode: 'new' | 'edit';
  onSubmit: () => void;
  /** Every account, for the payment-account picker; it offers only `paymentAccountCandidates`. */
  accounts?: readonly Account[];
  /** The account being edited, which is never its own payment account. */
  accountId?: string | null;
}

const NO_ACCOUNTS: readonly Account[] = [];

/** §6.22. Same shape for new and edit: two required fields is not a wizard. */
export function AccountForm({
  values,
  onChange,
  mode,
  onSubmit,
  accounts = NO_ACCOUNTS,
  accountId = null,
}: AccountFormProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const currency = settings?.currency ?? 'EUR';
  const set = (patch: Partial<AccountFormValues>) => onChange({ ...values, ...patch });
  const missing = accountMissingForSave(values);
  const colour = theme.categoryColor(values.colorIndex);

  const [sheet, setSheet] = useState<
    'none' | 'type' | 'appearance' | 'close' | 'charge' | 'payment'
  >('none');
  const close = () => setSheet('none');
  const day = (value: number | null) => (value === null ? t('categories.noParent') : String(value));
  // Looked up in every account, so one archived since it was picked still reads by its name.
  const paymentName =
    accounts.find((account) => account.id === values.creditPaymentAccountId)?.name ??
    t('accounts.noPaymentAccount');

  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
          {missing === null ? null : (
            // Not an error — nothing is wrong yet — so it is a muted line, not a red one.
            <Text size="footnote" color="textMuted">
              {t(`accounts.missing_${missing}`)}
            </Text>
          )}
          <PrimaryButton label={t('common.save')} disabled={missing !== null} onPress={onSubmit} />
        </View>
      }
    >
      <ScreenHeader title={mode === 'new' ? t('accounts.newAccount') : t('accounts.editAccount')} />

      <Card>
        <Text size="footnote" color="textMuted">
          {t('accounts.balance')}
        </Text>
        <View style={{ marginTop: 6 }}>
          <AmountInput
            buffer={values.buffer}
            onChange={(buffer) => set({ buffer })}
            currency={currency}
            locale={locale}
            autoFocus={mode === 'new'}
            label={t('accounts.balance')}
            doneLabel={t('common.done')}
            allowNegative
            negativeLabel={t('common.negative')}
          />
        </View>
      </Card>

      <Card>
        <View style={{ gap: 14 }}>
          <TextField
            label={t('accounts.name')}
            value={values.name}
            onChangeText={(name) => set({ name })}
          />
          {/* Typing, not choosing: it stays inline. */}
          <TextField
            label={t('accounts.institution')}
            value={values.institution}
            onChangeText={(institution) => set({ institution })}
          />
        </View>
      </Card>

      {/*
        The rows below each open a sheet. They used to be wrapping grids — five type tiles, twelve
        swatches, eight icons and two 28-day grids — which is around 400pt of picker sitting above
        `includeInSpendable`, the switch that decides whether the account counts towards Totale
        spendibile. The most consequential control on the screen was under the most decorative one.
      */}
      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 4 }}>
          <ListRow
            title={t('accounts.type')}
            subtitle={t(`accountTypes.${values.type}`)}
            onPress={() => setSheet('type')}
            chevron
          />
          <ListRow
            title={t('common.appearance')}
            leading={<IconBox name={values.icon} colour={colour} />}
            onPress={() => setSheet('appearance')}
            chevron
          />
          {values.type === 'credit_card' ? (
            <>
              <ListRow
                title={t('accounts.creditCloseDay')}
                subtitle={day(values.creditCloseDay)}
                onPress={() => setSheet('close')}
                chevron
              />
              <ListRow
                title={t('accounts.creditChargeDay')}
                subtitle={day(values.creditChargeDay)}
                onPress={() => setSheet('charge')}
                chevron
              />
              <ListRow
                title={t('accounts.creditPaymentAccount')}
                subtitle={paymentName}
                onPress={() => setSheet('payment')}
                chevron
              />
            </>
          ) : null}
        </View>
      </Card>

      <Card>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text style={{ flex: 1 }}>{t('accounts.includeInSpendable')}</Text>
          <Toggle
            value={values.includeInSpendable}
            onChange={(includeInSpendable) => set({ includeInSpendable })}
            accessibilityLabel={t('accounts.includeInSpendable')}
          />
        </View>
        <Text size="caption" color="textFaint" style={{ marginTop: 4 }}>
          {t('accounts.includeNote')}
        </Text>
      </Card>

      <AccountTypeSheet
        visible={sheet === 'type'}
        onClose={close}
        value={values.type}
        onSelect={(type) => set({ type })}
      />

      <AppearanceSheet
        visible={sheet === 'appearance'}
        onClose={close}
        colorIndex={values.colorIndex}
        icon={values.icon}
        groups={[{ key: 'accounts', icons: accountIconOptions }]}
        onChange={({ colorIndex, icon }) => set({ colorIndex, icon })}
      />

      <DayOfMonthSheet
        visible={sheet === 'close'}
        onClose={close}
        title={t('accounts.creditCloseDay')}
        value={values.creditCloseDay}
        onSelect={(creditCloseDay) => set({ creditCloseDay })}
      />

      <DayOfMonthSheet
        visible={sheet === 'charge'}
        onClose={close}
        title={t('accounts.creditChargeDay')}
        value={values.creditChargeDay}
        onSelect={(creditChargeDay) => set({ creditChargeDay })}
      />

      <PaymentAccountSheet
        visible={sheet === 'payment'}
        onClose={close}
        accounts={paymentAccountCandidates(accounts, accountId)}
        selected={values.creditPaymentAccountId}
        onSelect={(creditPaymentAccountId) => set({ creditPaymentAccountId })}
      />
    </Screen>
  );
}
