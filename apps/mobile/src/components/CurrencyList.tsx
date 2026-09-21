import { type CurrencyCode, getCurrency, groupCurrencies } from '@saldo/core';
import { currencyName } from '@saldo/i18n';
import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { OptionRow } from '../features/profile/SettingScreen';
import { useAppLocale } from '../i18n/useAppLocale';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';
import { Card } from './Card';
import { SectionDivider } from './SectionDivider';
import { TextField } from './TextField';

export interface CurrencyListProps {
  value: CurrencyCode;
  onSelect: (code: CurrencyCode) => void;
  /** On a screen each group is a card; in a sheet, whose surface is already one, it is not. */
  card?: boolean;
}

/**
 * Every currency, "Comuni" first and then the rest A–Z, under a search field (§6.25). The same
 * list serves Profile → Valuta and the "Altra…" chip of onboarding.
 */
export function CurrencyList({ value, onSelect, card = false }: CurrencyListProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useAppLocale();
  const [query, setQuery] = useState('');
  const groups = useMemo(
    () => groupCurrencies(query, (code) => currencyName(code, locale)),
    [query, locale],
  );

  const group = (label: string, codes: CurrencyCode[]) => {
    if (codes.length === 0) return null;
    const rows = codes.map((code) => (
      <OptionRow
        key={code}
        label={code}
        subtitle={currencyName(code, locale)}
        selected={code === value}
        leading={<CurrencySymbol code={code} />}
        onPress={() => onSelect(code)}
      />
    ));
    return (
      <Fragment key={label}>
        <SectionDivider label={label} />
        {card ? (
          <Card padded={false}>
            <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
              {rows}
            </View>
          </Card>
        ) : (
          <View>{rows}</View>
        )}
      </Fragment>
    );
  };

  return (
    <>
      <TextField
        label={t('currencyPicker.search')}
        placeholder={t('currencyPicker.search')}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />
      {group(t('currencyPicker.common'), groups.common)}
      {group(t('currencyPicker.all'), groups.others)}
      {groups.common.length === 0 && groups.others.length === 0 ? (
        <Text color="textMuted">{t('currencyPicker.noResults')}</Text>
      ) : null}
    </>
  );
}

/** The symbol in a box, as the user sees it in every amount; "F CFA" is shrunk to fit. */
function CurrencySymbol({ code }: { code: CurrencyCode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: theme.layout.iconBox,
        height: theme.layout.iconBox,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
        borderRadius: theme.radii.iconBox,
        backgroundColor: theme.palette.raised,
      }}
    >
      <Text size="footnote" weight="medium" numberOfLines={1} adjustsFontSizeToFit>
        {getCurrency(code).symbol}
      </Text>
    </View>
  );
}
