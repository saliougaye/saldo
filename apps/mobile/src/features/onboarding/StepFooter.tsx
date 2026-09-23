import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { type ButtonProps, PrimaryButton } from '../../components/Button';
import { useAmountKeypad } from '../../components/keypad/AmountKeypadProvider';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The bottom of a numbered onboarding step (§6.29): "Indietro" as quiet text, the primary action
 * filling the rest. Back lives here rather than in a header button so the top of the screen is
 * only the strip and the question.
 *
 * On the steps that own an amount keypad the pad's tall key *is* the primary action (§5.1), so the
 * button steps aside while the pad is up rather than offering the same thing twice; "Indietro"
 * stays, because the way back must never disappear.
 */
export function StepFooter({ label, ...rest }: ButtonProps) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAmountKeypad();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {router.canGoBack() ? (
        <Pressable
          testID="back-button"
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => ({
            minHeight: theme.layout.minHitTarget,
            paddingHorizontal: 12,
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text weight="medium" color="textMuted" size="headline" tracking="tight">
            {t('common.back')}
          </Text>
        </Pressable>
      ) : null}
      {session === null ? (
        <View style={{ flex: 1 }}>
          <PrimaryButton label={label} {...rest} />
        </View>
      ) : null}
    </View>
  );
}
