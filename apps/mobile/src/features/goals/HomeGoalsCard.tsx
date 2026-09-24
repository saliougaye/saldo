import {
  featuredTarget,
  type GoalTargetInput,
  goalCardStatus,
  goalEventIds,
  rankGoal,
} from '@saldo/core';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Card } from '../../components/Card';
import { CardHeader } from '../../components/CardHeader';
import { ListRow } from '../../components/ListRow';
import { TargetRing } from '../../components/TargetRing';
import { useDatabase } from '../../db/DatabaseProvider';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { FeaturedTarget } from '../targets/FeaturedTarget';
import { SeeAllRow } from '../targets/SeeAllRow';
import type { GoalView } from './goalViews';
import { useGoalText } from './useGoalText';

/** Device-local (never synced): the goal featured last, for the hysteresis of §5.13. */
export const FEATURED_GOAL_KEY = 'home.featuredGoal';

/** §5.13 for goals: always reads today, whatever period Home shows. */
export function HomeGoalsCard({ views }: { views: readonly GoalView[] }) {
  const theme = useTheme();
  const router = useRouter();
  const { kv } = useDatabase();
  const text = useGoalText();
  const { t } = text;

  const inputs = useMemo<GoalTargetInput[]>(
    () => views.map((view) => ({ id: view.account.id, progress: view.progress })),
    [views],
  );
  const [previous, setPrevious] = useState(() => kv.get(FEATURED_GOAL_KEY));
  const featuredId = useMemo(
    () => featuredTarget(inputs.map(rankGoal), previous),
    [inputs, previous],
  );
  useEffect(() => {
    if (featuredId === null || featuredId === previous) return;
    kv.set(FEATURED_GOAL_KEY, featuredId);
    setPrevious(featuredId);
  }, [featuredId, previous, kv]);

  if (views.length === 0) {
    return (
      <Card>
        <CardHeader title={t('goals.title')} status={t('goals.empty')} />
        <SeeAllRow label={t('goals.create')} onPress={() => router.push('/goal/new')} />
      </Card>
    );
  }

  const openGoal = (id: string) => router.push({ pathname: '/goal/[id]', params: { id } });
  const colourOf = (view: GoalView) => theme.categoryColor(view.account.colorIndex);
  const percentOf = (view: GoalView) =>
    t('targets.percent', { value: Math.round(view.progress.ratio * 100) });
  const toneColour = (view: GoalView) => {
    const tone = text.tone(view);
    return tone === 'attention' ? 'accent' : tone === 'done' ? 'positive' : 'textMuted';
  };

  const status = goalCardStatus(inputs);
  const parts = [
    status.expired > 0 ? t('goals.expired', { count: status.expired }) : null,
    status.behind > 0 ? t('goals.behind', { count: status.behind }) : null,
    status.reached > 0 ? t('goals.reached', { count: status.reached }) : null,
  ].filter((part): part is string => part !== null);
  const statusText = parts.length === 0 ? t('goals.onTime') : parts.slice(0, 2).join(' · ');

  const featured = views.find((view) => view.account.id === featuredId);
  const eventIds = goalEventIds(inputs, featuredId);
  const events = eventIds.flatMap((id) => views.filter((view) => view.account.id === id));
  const rest = views.filter(
    (view) => view.account.id !== featuredId && !eventIds.includes(view.account.id),
  );

  return (
    <Card>
      <CardHeader
        title={t('goals.title')}
        status={statusText}
        statusTone={status.expired + status.behind > 0 ? 'accent' : 'muted'}
      />

      {featured === undefined ? null : (
        <FeaturedTarget
          icon={featured.account.icon as IconName}
          colour={colourOf(featured)}
          name={featured.account.name}
          meta={text.meta(featured, true)}
          amount={featured.progress.saved}
          currency={text.currency}
          locale={text.locale}
          of={text.of(featured)}
          ratio={featured.progress.ratio}
          pace={text.pace(featured)}
          tone={text.tone(featured)}
          start={text.ends(featured).start}
          end={text.ends(featured).end}
          sentence={text.sentence(featured)}
          accessibilityLabel={text.label(featured)}
          onPress={() => openGoal(featured.account.id)}
        />
      )}

      {events.length === 0 ? null : (
        <View style={{ borderTopWidth: 1, borderTopColor: theme.palette.border, paddingTop: 4 }}>
          {events.map((view) => (
            <ListRow
              key={view.account.id}
              title={view.account.name}
              subtitle={text.meta(view)}
              leading={
                <TargetRing
                  size={theme.layout.targetRing}
                  ratio={view.progress.ratio}
                  pace={text.pace(view)}
                  tone={text.tone(view)}
                  icon={view.account.icon as IconName}
                  colour={colourOf(view)}
                />
              }
              trailing={
                <View style={{ alignItems: 'flex-end' }}>
                  <Text tabular>{percentOf(view)}</Text>
                  <Text size="footnote" color={toneColour(view)} tabular>
                    {text.status(view)}
                  </Text>
                </View>
              }
              onPress={() => openGoal(view.account.id)}
            />
          ))}
        </View>
      )}

      <SeeAllRow
        label={t('goals.all')}
        count={views.length}
        rings={rest.map((view) => ({
          id: view.account.id,
          ratio: view.progress.ratio,
          pace: text.pace(view),
          tone: text.tone(view),
          icon: view.account.icon as IconName,
          colour: colourOf(view),
        }))}
        onPress={() => router.push('/goals')}
      />
    </Card>
  );
}
