import {
  amountBufferToMinor,
  COMMON_CURRENCY_CODES,
  type CurrencyCode,
  getCurrency,
} from '@saldo/core';
import { formatMoney } from '@saldo/i18n';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { PrimaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Keypad } from '../../src/components/Keypad';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { Segmented } from '../../src/components/Segmented';
import { TextField } from '../../src/components/TextField';
import { useOnboarding } from '../../src/features/onboarding/state';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

const TYPES = ['cash', 'checking', 'credit_card', 'savings'] as const;

/** §6.29 step 2: name, type, balance keypad and currency picker. */
export default function FirstAccountStep() {
  const theme = useTheme();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { draft, setDraft } = useOnboarding();
  const [name, setName] = useState(draft.accountName);
  const [type, setType] = useState(draft.accountType);
  const [buffer, setBuffer] = useState(draft.balanceBuffer);
  const [currency, setCurrency] = useState<CurrencyCode>(draft.currency);
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const { minorDigits } = getCurrency(currency);

  return (
    <Screen
      footer={
        <PrimaryButton
          label={t('common.continue')}
          onPress={() => {
            setDraft({
              accountName: name.trim(),
              accountType: type,
              balanceBuffer: buffer,
              currency,
            });
            router.push('/categories');
          }}
        />
      }
    >
      <ProgressBar ratio={2 / 3} />
      <Text size="caption" color="textFaint">
        {t('onboarding.step', { current: 2, total: 3 })}
      </Text>
      <Text size="display" weight="semibold" tracking="tighter">
        {t('onboarding.accountTitle')}
      </Text>
      <Text color="textMuted">{t('onboarding.accountBody')}</Text>

      <Card>
        <View style={{ gap: 14 }}>
          <TextField
            label={t('onboarding.accountName')}
            placeholder={t('onboarding.accountNamePlaceholder')}
            value={name}
            onChangeText={setName}
          />
          <View style={{ gap: 6 }}>
            <Text size="footnote" color="textMuted">
              {t('onboarding.accountType')}
            </Text>
            <Segmented
              accessibilityLabel={t('onboarding.accountType')}
              options={TYPES.map((value) => ({ value, label: t(`accountTypes.${value}`) }))}
              value={type}
              onChange={setType}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text size="footnote" color="textMuted">
              {t('onboarding.accountCurrency')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {COMMON_CURRENCY_CODES.map((code) => {
                const selected = code === currency;
                return (
                  <Pressable
                    key={code}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setCurrency(code)}
                    style={{
                      flex: 1,
                      height: 38,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: theme.radii.chipSmall,
                      backgroundColor: selected ? theme.palette.accent : theme.palette.raised,
                    }}
                  >
                    <Text size="footnote" color={selected ? 'onAccent' : 'text'}>
                      {code}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Card>

      <Card>
        <Text size="footnote" color="textMuted">
          {t('onboarding.accountBalance')}
        </Text>
        <Text size="amountLg" weight="semibold" tracking="tighter" tabular style={{ marginTop: 4 }}>
          {formatMoney(amountBufferToMinor(buffer, minorDigits), currency, locale)}
        </Text>
        <View style={{ marginTop: 12 }}>
          <Keypad
            buffer={buffer}
            onChange={setBuffer}
            minorDigits={minorDigits}
            decimalSeparator={locale === 'it' ? ',' : '.'}
            saveLabel={t('common.done')}
          />
        </View>
      </Card>
    </Screen>
  );
}
