import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Full-screen spinner on the theme background. Used for the boot gaps — migrations, the i18n
 * bundle, the first settings read — which happen before i18n exists, so it carries no text.
 */
export function LoadingScreen() {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.palette.bg,
      }}
    >
      <ActivityIndicator color={theme.palette.textMuted} />
    </View>
  );
}
