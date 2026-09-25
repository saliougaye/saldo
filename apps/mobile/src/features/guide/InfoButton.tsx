import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { PrimaryButton } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import type { GuideConceptId } from './concepts';
import { GuideIcon, GuideText } from './GuideContent';

/** The glyph and the room around it; `hitSlop` grows it to the 44pt hit target (§13). */
const GLYPH = 16;
const BOX = 28;

/**
 * The ⓘ of §6.41: a muted glyph right after the label it explains, opening that concept's whole
 * text in a sheet. It owns the sheet, so a placement is one element and nothing to wire; inside
 * another sheet the second one is rendered in the first one's tree, which is how iOS presents a
 * modal over a modal.
 */
export function InfoButton({ concept }: { concept: GuideConceptId }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const title = t(`guide.${concept}.title`);
  const slop = (theme.layout.minHitTarget - BOX) / 2;
  return (
    <>
      <Pressable
        testID={`info-${concept}`}
        accessibilityRole="button"
        accessibilityLabel={t('guide.infoLabel', { title })}
        hitSlop={slop}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          width: BOX,
          height: BOX,
          marginVertical: -(BOX - GLYPH) / 2,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Icon name="info" size={GLYPH} color={theme.palette.textMuted} />
      </Pressable>
      <GuideSheet concept={concept} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function GuideSheet({
  concept,
  visible,
  onClose,
}: {
  concept: GuideConceptId;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ gap: 12, paddingTop: 4 }}>
        <GuideIcon id={concept} />
        <Text size="title" weight="semibold" tracking="tighter" accessibilityRole="header">
          {t(`guide.${concept}.title`)}
        </Text>
        <GuideText id={concept} />
      </ScrollView>
      <View style={{ paddingTop: 8 }}>
        <PrimaryButton label={t('common.done')} onPress={onClose} />
      </View>
    </Sheet>
  );
}
