import { useTranslation } from 'react-i18next';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/theme/Text';

export default function HomeTab() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Text size="display" weight="semibold" tracking="tighter">
        {t('tabs.home')}
      </Text>
      <Card>
        <Text color="textMuted">{t('placeholders.homeSoon')}</Text>
        <Text color="textFaint" size="footnote" style={{ marginTop: 6 }}>
          {t('placeholders.comingSoon')}
        </Text>
      </Card>
    </Screen>
  );
}
