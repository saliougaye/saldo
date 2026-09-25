import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import { SectionLabel } from '../../src/components/SectionLabel';
import { GUIDE_CONCEPTS, GUIDE_SECTIONS } from '../../src/features/guide/concepts';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * §6.42. One card per section, a row per concept with the sentence the intro uses: the list
 * already teaches something before anything is opened.
 */
export default function GuideScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <Screen>
      <BackButton />
      <Text size="display" weight="semibold" tracking="tighter" accessibilityRole="header">
        {t('guide.title')}
      </Text>
      <Text color="textMuted">{t('guide.subtitle')}</Text>
      {GUIDE_SECTIONS.map((section) => (
        <View key={section} style={{ gap: 6 }}>
          <SectionLabel>{t(`guide.section_${section}`)}</SectionLabel>
          <Card padded={false}>
            <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 4 }}>
              {GUIDE_CONCEPTS.filter((concept) => concept.section === section).map((concept) => (
                <ListRow
                  key={concept.id}
                  testID={`guide-${concept.id}`}
                  title={t(`guide.${concept.id}.title`)}
                  subtitle={t(`guide.${concept.id}.summary`)}
                  subtitleLines={0}
                  leading={<IconBox name={concept.icon} colour={theme.palette.textMuted} />}
                  onPress={() =>
                    router.push({ pathname: '/guide/[id]', params: { id: concept.id } })
                  }
                  chevron
                />
              ))}
            </View>
          </Card>
        </View>
      ))}
    </Screen>
  );
}
