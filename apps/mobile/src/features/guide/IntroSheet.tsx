import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../components/Button';
import { stepEntering } from '../../theme/motion';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { INTRO_CONCEPTS } from './concepts';
import { GuideIcon } from './GuideContent';

/**
 * The first-run intro of §6.40: four ideas on one screen and one «Continua». The rows arrive like
 * an onboarding step's blocks, which it follows; with Reduce Motion they only fade, as the modal
 * itself does.
 */
export function IntroSheet({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View
        accessibilityViewIsModal
        style={{ flex: 1, backgroundColor: theme.palette.bg, paddingTop: insets.top }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.layout.screenPaddingX + 12,
            paddingTop: 28,
            paddingBottom: 16,
            gap: 26,
          }}
        >
          <Animated.View entering={stepEntering(0)}>
            <Text size="display" weight="semibold" tracking="tightest" accessibilityRole="header">
              {t('guide.introTitle')}
            </Text>
          </Animated.View>
          {INTRO_CONCEPTS.map((concept, index) => (
            <Animated.View
              key={concept.id}
              entering={stepEntering(index + 1)}
              accessible
              accessibilityLabel={`${t(`guide.${concept.id}.title`)}. ${t(`guide.${concept.id}.summary`)}`}
              style={{ flexDirection: 'row', gap: 16 }}
            >
              <GuideIcon id={concept.id} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text weight="semibold">{t(`guide.${concept.id}.title`)}</Text>
                <Text color="textMuted">{t(`guide.${concept.id}.summary`)}</Text>
              </View>
            </Animated.View>
          ))}
        </ScrollView>
        <View
          style={{
            paddingHorizontal: theme.layout.screenPaddingX,
            paddingTop: 12,
            paddingBottom: insets.bottom + 16,
            gap: 14,
          }}
        >
          <Text size="footnote" color="textFaint" style={{ textAlign: 'center' }}>
            {t('guide.introFoot')}
          </Text>
          <PrimaryButton testID="intro-continue" label={t('common.continue')} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
