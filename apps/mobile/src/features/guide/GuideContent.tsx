import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { type GuideConceptId, guideConcept, paragraphs } from './concepts';

/** The icon of an explanation: larger than a row's, in the text colour rather than a tint. */
export function GuideIcon({ id }: { id: GuideConceptId }) {
  const theme = useTheme();
  const concept = guideConcept(id);
  if (concept === undefined) return null;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: theme.layout.iconBoxLarge,
        height: theme.layout.iconBoxLarge,
        borderRadius: theme.radii.button,
        backgroundColor: theme.palette.raised,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={concept.icon} size={22} color={theme.palette.text} />
    </View>
  );
}

/**
 * A concept's text, the same in the ⓘ sheet and on its Guida page (§6.41, §6.42): the summary in
 * the text colour, then the body's paragraphs muted.
 */
export function GuideText({ id }: { id: GuideConceptId }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 10 }}>
      <Text>{t(`guide.${id}.summary`)}</Text>
      {paragraphs(t(`guide.${id}.body`)).map((paragraph) => (
        <Text key={paragraph} color="textMuted">
          {paragraph}
        </Text>
      ))}
    </View>
  );
}
