import { formatCycleRange } from '@saldo/i18n';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useServer } from '../../auth/ServerProvider';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { HideAmountsButton } from '../hidden/HideAmountsButton';
import { initialsFrom } from '../profile/initials';
import { usePeriod } from './PeriodProvider';
import { PeriodSheet } from './PeriodSheet';

export interface PeriodHeaderProps {
  /**
   * The avatar that opens the profile (§6.1). Home shows it; the other tabs share this header but
   * not the avatar, which the design puts on the home screen alone.
   */
  showProfile?: boolean;
  /**
   * The eye that toggles hidden mode. Off on the Transactions tab, where nothing hides: single
   * transactions stay readable by decision, and a button that does nothing visible is a broken one.
   */
  hideAmounts?: boolean;
}

/** Header of §6.1: the period label with its subtitle, plus ‹ › cycle navigation. */
export function PeriodHeader({ showProfile = false, hideAmounts = true }: PeriodHeaderProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { today, period, shift, canShift } = usePeriod();
  const router = useRouter();
  const { user } = useServer();
  const [sheetOpen, setSheetOpen] = useState(false);

  // A custom range reads the same way a period does; only the subtitle below tells them apart.
  const label = formatCycleRange(period.range, locale, today);
  const subtitle = period.isCurrent
    ? t('period.dayOf', { elapsed: period.elapsed, length: period.length })
    : t('period.closed');

  const navButton = (direction: -1 | 1) => {
    // Forward stops at the current period (§6.15): what comes next is in «In arrivo» and the
    // forecast, and a disabled arrow says that better than a screen of empty cards would.
    const allowed = canShift(direction);
    return (
      <Pressable
        testID={direction === -1 ? 'period-previous' : 'period-next'}
        accessibilityRole="button"
        accessibilityLabel={direction === -1 ? t('period.previous') : t('period.next')}
        accessibilityState={{ disabled: !allowed }}
        hitSlop={10}
        disabled={!allowed}
        onPress={() => shift(direction)}
        style={{
          width: 36,
          height: theme.layout.headerButton,
          alignItems: 'center',
          justifyContent: 'center',
          // The pair shares one rounded-square shell (below); the second button draws the divider.
          borderStartWidth: direction === 1 ? 1 : 0,
          borderStartColor: theme.palette.border,
          opacity: allowed ? 1 : 0.4,
        }}
      >
        <Icon
          name={direction === -1 ? 'chevL' : 'chevR'}
          size={16}
          color={theme.palette.textMuted}
        />
      </Pressable>
    );
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 }}>
      {showProfile ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile.title')}
          hitSlop={8}
          onPress={() => router.push('/profile')}
          style={{
            width: theme.layout.headerButton,
            height: theme.layout.headerButton,
            borderRadius: theme.radii.pill,
            borderWidth: 1,
            borderColor: theme.palette.border,
            backgroundColor: theme.palette.raised,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text size="caption" weight="medium" color="textMuted">
            {initialsFrom(user?.displayName ?? null)}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        testID="period-picker"
        accessibilityRole="button"
        // One element for VoiceOver, so its label carries what the two lines show: the dates and
        // «day N of M» (or «closed period»), not only the word «Period».
        accessibilityLabel={t('period.headerLabel', { range: label, status: subtitle })}
        // A line of body text over a caption is ~32pt. Only the height grows — the picker is
        // already the width of the header — so the arrows beside it keep every tap of their own.
        hitSlop={{ top: 6, bottom: 6 }}
        onPress={() => setSheetOpen(true)}
        style={({ pressed }) => ({ flex: 1, minWidth: 0, opacity: pressed ? 0.6 : 1 })}
      >
        {/* What says the period is a control. Two arrows rather than one: the ‹ › buttons beside
            it already use single chevrons to *move* the period, and a third one pointing down
            would have read as more of the same. This is the shape a picker has. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text weight="medium" tracking="tight" numberOfLines={1} style={{ flexShrink: 1 }}>
            {label}
          </Text>
          <Icon name="chevUD" size={14} color={theme.palette.textFaint} />
        </View>
        <Text size="caption" color="textMuted">
          {subtitle}
        </Text>
      </Pressable>
      {hideAmounts ? <HideAmountsButton /> : null}
      {/* ‹ › as one control, the shape the design gives it (`Spese.dc.html` line 66): a 9px
          rounded square holding two buttons, not two circles. */}
      <View
        style={{
          flexDirection: 'row',
          height: theme.layout.headerButton,
          borderRadius: theme.radii.chipSmall,
          borderWidth: 1,
          borderColor: theme.palette.border,
          backgroundColor: theme.palette.raised,
          overflow: 'hidden',
        }}
      >
        {navButton(-1)}
        {navButton(1)}
      </View>
      <PeriodSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}
