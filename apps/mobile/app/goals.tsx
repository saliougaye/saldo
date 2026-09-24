import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Card } from '../src/components/Card';
import { EmptyState } from '../src/components/EmptyState';
import { IconBox, ListRow } from '../src/components/ListRow';
import { Screen } from '../src/components/Screen';
import { BackButton } from '../src/components/ScreenHeader';
import { SectionLabel } from '../src/components/SectionLabel';
import { GoalCard } from '../src/features/goals/GoalCard';
import { useGoalText } from '../src/features/goals/useGoalText';
import { useGoalViews } from '../src/features/goals/useGoalViews';
import { useRestoreGoal } from '../src/features/goals/useRestoreGoal';
import { FeaturedTarget } from '../src/features/targets/FeaturedTarget';
import { Text } from '../src/theme/Text';
import { useTheme } from '../src/theme/ThemeProvider';

/** §6.35. */
export default function GoalsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { views, accounts, loaded } = useGoalViews();
  const restore = useRestoreGoal();
  const text = useGoalText();
  const { t } = useTranslation();
  const closed = accounts.filter(
    (account) => account.type === 'pocket' && account.archivedAt !== null,
  );
  const create = () => router.push('/goal/new');

  return (
    <Screen refreshable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BackButton />
        <Text size="display" weight="semibold" tracking="tighter" style={{ flex: 1 }}>
          {t('goals.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('goals.newGoal')}
          hitSlop={10}
          onPress={create}
        >
          <IconBox name="plus" colour={theme.palette.textMuted} small />
        </Pressable>
      </View>

      {!loaded ? null : views.length === 0 ? (
        <EmptyState
          kind="yet"
          ghost="bar"
          title={t('goals.empty')}
          body={t('goals.emptyBody')}
          action={{ label: t('goals.newGoal'), onPress: create }}
        />
      ) : (
        views.map((view) => (
          <GoalCard key={view.account.id} reached={view.progress.state === 'reached'}>
            <FeaturedTarget
              icon={view.account.icon as IconName}
              colour={theme.categoryColor(view.account.colorIndex)}
              name={view.account.name}
              meta={text.meta(view, true)}
              amount={view.progress.saved}
              currency={text.currency}
              locale={text.locale}
              of={text.of(view)}
              ratio={view.progress.ratio}
              pace={text.pace(view)}
              tone={text.tone(view)}
              start={text.ends(view).start}
              end={text.ends(view).end}
              sentence={text.sentence(view)}
              accessibilityLabel={text.label(view)}
              onPress={() =>
                router.push({ pathname: '/goal/[id]', params: { id: view.account.id } })
              }
            />
          </GoalCard>
        ))
      )}

      {closed.length === 0 ? null : (
        <>
          <SectionLabel>{t('goals.closedSection')}</SectionLabel>
          <Card padded={false}>
            <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
              {closed.map((account) => (
                <ListRow
                  key={account.id}
                  title={account.name}
                  leading={
                    <IconBox name={account.icon as IconName} colour={theme.palette.textFaint} />
                  }
                  trailing={
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => restore(account.id)}
                    >
                      <Text color="accent" weight="medium">
                        {t('common.restore')}
                      </Text>
                    </Pressable>
                  }
                />
              ))}
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}
