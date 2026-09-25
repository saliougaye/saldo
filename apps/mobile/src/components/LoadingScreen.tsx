import { mascot } from '@saldo/ui';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';
import { Mascot } from './Mascot';

/**
 * Full-screen wait on the theme background. Used for the boot gaps — migrations, the i18n
 * bundle, the first settings read — and those happen before i18n exists, so `label` is optional
 * and the screen is wordless without it.
 *
 * Pass one wherever the wait can be long enough to look like a hang: a spinner that never says
 * what it is waiting for is indistinguishable from a spinner that is stuck. A labelled wait is a
 * long one, so Rocky waits through it instead of the spinner (§13 *Mascot*); the short ones keep
 * the spinner, since he would arrive and leave in the same instant.
 */
export function LoadingScreen({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        backgroundColor: theme.palette.bg,
      }}
    >
      {label === undefined ? (
        <ActivityIndicator testID="loading-spinner" color={theme.palette.textMuted} />
      ) : (
        <>
          <Mascot state="loading" size={mascot.loadingSize} />
          <Text size="footnote" color="textMuted">
            {label}
          </Text>
        </>
      )}
    </View>
  );
}
