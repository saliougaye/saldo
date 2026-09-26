import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card } from '../../src/components/Card';
import { NotFoundScreen } from '../../src/components/NotFoundScreen';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import { isGuideConceptId } from '../../src/features/guide/concepts';
import { GuideIcon, GuideText } from '../../src/features/guide/GuideContent';
import { Text } from '../../src/theme/Text';

/** §6.42: one concept, the same text its ⓘ opens. */
export default function GuidePage() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  if (id === undefined || !isGuideConceptId(id)) return <NotFoundScreen />;
  return (
    <Screen>
      <BackButton />
      <GuideIcon id={id} />
      <Text size="display" weight="semibold" tracking="tighter" accessibilityRole="header">
        {t(`guide.${id}.title`)}
      </Text>
      <Card>
        <GuideText id={id} />
      </Card>
    </Screen>
  );
}
