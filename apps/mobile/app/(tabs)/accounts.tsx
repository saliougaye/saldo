import { useTranslation } from 'react-i18next';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/theme/Text';

export default function AccountsTab() {
  const { t } = useTranslation();
  return (
    <Screen underTabBar>
      <Text size="display" weight="semibold" tracking="tighter">
        {t('tabs.accounts')}
      </Text>
      <Card>
        <Text color="textMuted">{t('placeholders.accountsSoon')}</Text>
        <Text color="textFaint" size="footnote" style={{ marginTop: 6 }}>
          {t('placeholders.comingSoon')}
        </Text>
      </Card>
    </Screen>
  );
}
