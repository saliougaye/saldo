import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { type ButtonProps, PrimaryButton } from '../../components/Button';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The bottom of a numbered onboarding step (§6.29): "Indietro" as quiet text, the primary action
 * filling the rest. Back lives here rather than in a header button so the top of the screen is
 * only the strip and the question.
 */
export function StepFooter({ label, ...rest }: ButtonProps) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
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
      <View style={{ flex: 1 }}>
        <PrimaryButton label={label} {...rest} />
      </View>
    </View>
  );
}
