import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Icon } from '../theme/Icon';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface BackButtonProps {
  /** Defaults to `router.back()`; screens that must confirm before leaving pass their own. */
  onPress?: () => void;
  /**
   * `x` for a screen presented as a sheet: it is dismissed, not navigated back from, and the two
   * gestures deserve two different icons.
   */
  icon?: 'chevL' | 'x';
}

/**
 * The back affordance of every pushed screen. The native header is off (`headerShown: false` in
 * the root Stack) because §6 draws its own chrome, so without this a pushed screen has no way back
 * other than the platform swipe gesture.
 */
export function BackButton({ onPress, icon = 'chevL' }: BackButtonProps) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  // A deep link can open a screen with nothing behind it; there is then nothing to go back to.
  if (onPress === undefined && !router.canGoBack()) return null;
  return (
    <Pressable
      testID="back-button"
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      hitSlop={10}
      onPress={onPress ?? (() => router.back())}
      style={{
        width: theme.layout.headerButton,
        height: theme.layout.headerButton,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radii.pill,
        backgroundColor: theme.palette.raised,
      }}
    >
      <Icon name={icon} size={16} color={theme.palette.text} />
    </Pressable>
  );
}

export interface HeaderIconButtonProps {
  icon: IconName;
  /** Read aloud in place of the icon, which has no text of its own. */
  label: string;
  onPress: () => void;
}

/** An icon-only action on the trailing edge of a `ScreenHeader`, the same disc as the back button. */
export function HeaderIconButton({ icon, label, onPress }: HeaderIconButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
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
      <Icon name={icon} size={16} color={theme.palette.text} />
    </Pressable>
  );
}

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Passed through to the back button; `x` for a screen presented as a sheet. */
  backIcon?: BackButtonProps['icon'];
  /** Defaults to `router.back()`; forms that must confirm before leaving pass their own. */
  onBack?: () => void;
  /** Actions on the trailing edge (e.g. the reorder toggle in "Categorie"). */
  trailing?: ReactNode;
}

/** Back button plus the screen title, for the pushed screens whose title is inline (§6.16). */
export function ScreenHeader({ title, subtitle, onBack, trailing, backIcon }: ScreenHeaderProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <BackButton onPress={onBack} icon={backIcon} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="headline" weight="semibold" tracking="tight" numberOfLines={1}>
          {title}
        </Text>
        {subtitle === undefined ? null : (
          <Text size="caption" color="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
    </View>
  );
}
