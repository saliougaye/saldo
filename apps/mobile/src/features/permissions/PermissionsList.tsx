import {
  nextPending,
  PERMISSION_ORDER,
  type PermissionAnswer,
  type PermissionKey,
} from '@saldo/core';
import { type IconName, motion } from '@saldo/ui';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Card } from '../../components/Card';
import { IconBox } from '../../components/ListRow';
import { Icon } from '../../theme/Icon';
import { expanding, leaving, revealing, swapIn } from '../../theme/motion';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

export const PERMISSION_ICONS: Record<PermissionKey, IconName> = {
  notifications: 'bell',
  camera: 'camera',
  appLock: 'scanFace',
};

export interface PermissionsListProps {
  answers: Readonly<Record<PermissionKey, PermissionAnswer>>;
  onActivate: (key: PermissionKey) => void;
  onLater: (key: PermissionKey) => void;
  onOpenSettings: () => void;
}

/**
 * The onboarding permissions step (§6.29, variant "Sequenza"): one card, one row open at a time —
 * the first still pending — with its sentence and «Attiva» / «Più tardi». An answered row closes
 * to its title and a status, so the card always shows how many are left.
 */
export function PermissionsList({
  answers,
  onActivate,
  onLater,
  onOpenSettings,
}: PermissionsListProps) {
  const theme = useTheme();
  const open = nextPending(answers);
  return (
    <Card padded={false}>
      <View style={{ paddingHorizontal: theme.layout.cardPadding }}>
        {PERMISSION_ORDER.map((key, index) => (
          <PermissionRow
            key={key}
            kind={key}
            answer={answers[key]}
            open={open === key}
            first={index === 0}
            onActivate={() => onActivate(key)}
            onLater={() => onLater(key)}
            onOpenSettings={onOpenSettings}
          />
        ))}
      </View>
    </Card>
  );
}

function PermissionRow({
  kind,
  answer,
  open,
  first,
  onActivate,
  onLater,
  onOpenSettings,
}: {
  kind: PermissionKey;
  answer: PermissionAnswer;
  open: boolean;
  first: boolean;
  onActivate: () => void;
  onLater: () => void;
  onOpenSettings: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Animated.View
      layout={expanding}
      style={{
        overflow: 'hidden',
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.palette.border,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: 60,
          paddingVertical: 14,
        }}
      >
        <IconBox name={PERMISSION_ICONS[kind]} colour={theme.palette.textMuted} />
        <Text
          weight="medium"
          tracking="tight"
          color={open ? 'text' : 'textMuted'}
          style={{ flex: 1 }}
          numberOfLines={1}
        >
          {t(`permissions.${kind}Title`)}
        </Text>
        {answer === 'pending' ? null : (
          // Keyed on the answer so a change (denied → granted from the settings) swaps in again.
          <Animated.View key={answer} entering={swapIn(motion.swapFromScale)}>
            <Status kind={kind} answer={answer} onOpenSettings={onOpenSettings} />
          </Animated.View>
        )}
      </View>
      {open ? (
        <Animated.View
          entering={revealing}
          exiting={leaving}
          style={{ paddingStart: 44, paddingBottom: 16 }}
        >
          <Text size="footnote" color="textMuted" style={{ lineHeight: 18 }}>
            {t(`permissions.${kind}Body`)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 }}>
            <Pressable
              testID={`permission-${kind}-activate`}
              accessibilityRole="button"
              accessibilityLabel={t('permissions.activate')}
              hitSlop={6}
              onPress={onActivate}
              style={({ pressed }) => ({
                minHeight: 32,
                paddingHorizontal: 14,
                justifyContent: 'center',
                borderRadius: theme.radii.chipSmall,
                backgroundColor: theme.palette.accent,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}
            >
              <Text size="footnote" weight="medium" color="onAccent">
                {t('permissions.activate')}
              </Text>
            </Pressable>
            <Pressable
              testID={`permission-${kind}-later`}
              accessibilityRole="button"
              accessibilityLabel={t('permissions.later')}
              hitSlop={6}
              onPress={onLater}
              style={({ pressed }) => ({
                minHeight: 32,
                paddingHorizontal: 10,
                justifyContent: 'center',
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}
            >
              <Text size="footnote" weight="medium" color="textMuted">
                {t('permissions.later')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function Status({
  kind,
  answer,
  onOpenSettings,
}: {
  kind: PermissionKey;
  answer: Exclude<PermissionAnswer, 'pending'>;
  onOpenSettings: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const label =
    answer === 'granted'
      ? t(`permissions.${kind}On`)
      : answer === 'denied'
        ? t(`permissions.${kind}Denied`)
        : t('permissions.later');
  const icon: IconName = answer === 'granted' ? 'check' : answer === 'denied' ? 'x' : 'clock';
  // The lock is Saldo's own setting: nothing in the system settings turns it on (Profile does).
  const settings = answer === 'denied' && kind !== 'appLock';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Animated.View entering={swapIn(motion.swapIconFromScale, motion.pressMs / 2)}>
        <Icon
          name={icon}
          size={14}
          color={answer === 'granted' ? theme.palette.positive : theme.palette.textMuted}
        />
      </Animated.View>
      <Text size="footnote" color={answer === 'granted' ? 'text' : 'textMuted'}>
        {label}
      </Text>
      {settings ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('permissions.openSettingsLabel')}
          hitSlop={10}
          onPress={onOpenSettings}
        >
          <Text size="footnote" style={{ textDecorationLine: 'underline' }}>
            {t('permissions.openSettings')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
