import type { CurrencyCode } from '@saldo/core';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { CurrencyList } from './CurrencyList';
import { Sheet } from './Sheet';

/** The full currency list for onboarding's "Altra…" chip (§6.25, §6.29). */
export function CurrencySheet({
  visible,
  onClose,
  value,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  value: CurrencyCode;
  onSelect: (code: CurrencyCode) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('onboarding.accountCurrency')} tall>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // The keyboard covers the bottom of the sheet; this lets the last rows scroll above it.
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ gap: theme.layout.cardGap, paddingBottom: 8 }}
      >
        <CurrencyList
          value={value}
          onSelect={(code) => {
            onSelect(code);
            onClose();
          }}
        />
      </ScrollView>
    </Sheet>
  );
}
