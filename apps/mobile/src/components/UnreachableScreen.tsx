import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';
import { SecondaryButton } from './Button';

/**
 * The one place a signed-in device is allowed to stop and wait for a person. It is shown when this
 * phone holds no settings **and** the server could not be asked whether the account has any: going
 * forward would offer onboarding to an account that may already have years of data, and seeding
 * over it fails on `settings.id` (§8.3).
 *
 * Deliberately not a dead end — the button runs another cycle, which is all that is missing.
 */
export function UnreachableScreen({ detail, onRetry }: { detail: string; onRetry: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 32,
        backgroundColor: theme.palette.bg,
      }}
    >
      <Text size="title" weight="semibold" tracking="tight">
        {t('sync.unreachableTitle')}
      </Text>
      <Text color="textMuted" style={{ textAlign: 'center' }}>
        {t('sync.unreachableBody')}
      </Text>
      <Text size="caption" color="textFaint">
        {detail}
      </Text>
      <SecondaryButton label={t('common.retry')} onPress={onRetry} />
    </View>
  );
}
