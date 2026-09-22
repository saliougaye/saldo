import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import { Icon } from '../../theme/Icon';
import { useTheme } from '../../theme/ThemeProvider';
import { useHiddenAmounts } from './hiddenAmounts';

/**
 * The eye that toggles hidden mode, in every tab header (2026-09-22 plan). The icon is the state:
 * open while the figures show, struck through while they hide. Same pill as the period arrows,
 * so it reads as one row of controls.
 */
export function HideAmountsButton() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { hidden, toggle } = useHiddenAmounts();
  return (
    <Pressable
      testID="hide-amounts"
      accessibilityRole="button"
      accessibilityLabel={hidden ? t('common.showAmounts') : t('common.hideAmounts')}
      accessibilityState={{ selected: hidden }}
      hitSlop={10}
      onPress={toggle}
      style={({ pressed }) => ({
        width: theme.layout.headerButton,
        height: theme.layout.headerButton,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radii.pill,
        backgroundColor: theme.palette.raised,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Icon
        name={hidden ? 'eyeOff' : 'eye'}
        size={16}
        color={hidden ? theme.palette.text : theme.palette.textMuted}
      />
    </Pressable>
  );
}
