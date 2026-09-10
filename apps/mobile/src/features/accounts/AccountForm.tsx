import {
  type Account,
  amountBufferToMinor,
  minorToAmountBuffer,
  openingBalanceForCurrent,
} from '@saldo/core';
import { accountIconOptions, categoryColors, type IconName } from '@saldo/ui';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AmountInput } from '../../components/AmountInput';
import { PrimaryButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { Toggle } from '../../components/Toggle';
import { useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

const TYPES = ['cash', 'checking', 'credit_card', 'savings', 'investment'] as const;

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

export interface AccountFormProps {
  values: AccountFormValues;
  onChange: (values: AccountFormValues) => void;
  mode: 'new' | 'edit';
  onSubmit: () => void;
}

/** §6.22. */
export function AccountForm({ values, onChange, mode, onSubmit }: AccountFormProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const currency = settings?.currency ?? 'EUR';
  const set = (patch: Partial<AccountFormValues>) => onChange({ ...values, ...patch });
  const ready = values.name.trim().length > 0;

  return (
    <Screen
      footer={<PrimaryButton label={t('common.save')} disabled={!ready} onPress={onSubmit} />}
    >
      <Text size="headline" weight="semibold" tracking="tight">
        {mode === 'new' ? t('accounts.newAccount') : t('accounts.editAccount')}
      </Text>

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
            doneLabel={t('common.done')}
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
          <TextField
            label={t('accounts.institution')}
            value={values.institution}
            onChangeText={(institution) => set({ institution })}
          />
          <View style={{ gap: 6 }}>
            <Text size="footnote" color="textMuted">
              {t('accounts.type')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {TYPES.map((type) => {
                const selected = type === values.type;
                return (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => set({ type })}
                    style={{
                      width: '31%',
                      height: 38,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: theme.radii.chipSmall,
                      backgroundColor: selected ? theme.palette.accent : theme.palette.raised,
                    }}
                  >
                    <Text size="caption" color={selected ? 'onAccent' : 'text'} numberOfLines={1}>
                      {t(`accountTypes.${type}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Card>

      {values.type === 'credit_card' ? (
        <Card>
          <View style={{ gap: 14 }}>
            <DayPicker
              label={t('accounts.creditCloseDay')}
              value={values.creditCloseDay}
              onChange={(creditCloseDay) => set({ creditCloseDay })}
            />
            <DayPicker
              label={t('accounts.creditChargeDay')}
              value={values.creditChargeDay}
              onChange={(creditChargeDay) => set({ creditChargeDay })}
            />
          </View>
        </Card>
      ) : null}

      <Card>
        <Text size="footnote" color="textMuted">
          {t('accounts.colour')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {categoryColors.map((colour, index) => (
            <Pressable
              key={colour}
              accessibilityRole="button"
              accessibilityState={{ selected: index === values.colorIndex }}
              accessibilityLabel={colour}
              onPress={() => set({ colorIndex: index })}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: colour,
                borderWidth: index === values.colorIndex ? 2 : 0,
                borderColor: theme.palette.text,
              }}
            />
          ))}
        </View>

        <Text size="footnote" color="textMuted" style={{ marginTop: 14 }}>
          {t('accounts.icon')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {accountIconOptions.map((name) => {
            const selected = name === values.icon;
            return (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={name}
                onPress={() => set({ icon: name })}
                style={{
                  width: 38,
                  height: 38,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: theme.radii.iconBox,
                  backgroundColor: selected
                    ? theme.tint(theme.categoryColor(values.colorIndex), 0.18)
                    : theme.palette.raised,
                }}
              >
                <Icon
                  name={name}
                  size={18}
                  color={
                    selected ? theme.categoryColor(values.colorIndex) : theme.palette.textMuted
                  }
                />
              </Pressable>
            );
          })}
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
    </Screen>
  );
}

/** Credit-card days are 1–28 so every month has them (§4). */
function DayPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text size="footnote" color="textMuted">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => {
          const selected = day === value;
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={String(day)}
              onPress={() => onChange(day)}
              style={{
                width: 30,
                height: 30,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radii.chipSmall,
                backgroundColor: selected ? theme.palette.accent : theme.palette.raised,
              }}
            >
              <Text size="caption" tabular color={selected ? 'onAccent' : 'text'}>
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
