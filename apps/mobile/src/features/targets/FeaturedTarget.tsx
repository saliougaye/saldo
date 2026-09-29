import { type CurrencyCode, endLabels } from '@saldo/core';
import type { AppLocale } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AmountText } from '../../components/AmountText';
import { IconBox } from '../../components/ListRow';
import { ProgressBar } from '../../components/ProgressBar';
import type { TargetTone } from '../../components/TargetRing';
import { Text } from '../../theme/Text';

/** Wide enough for «oggi» in every locale, centred on the tick. */
const TODAY_WIDTH = 64;

export interface FeaturedTargetProps {
  icon: IconName;
  colour: string;
  name: string;
  /** Short, beside the name: "52 € rimasti", "limite superato". */
  meta: string;
  /** What fills the bar: spent for a budget, saved for a goal. */
  amount: number;
  currency: CurrencyCode;
  locale: AppLocale;
  /** "di 420,00 € · 88%". */
  of: string;
  ratio: number;
  /** Where the tick and «oggi» sit; null for none. */
  pace: number | null;
  tone: TargetTone;
  /** Labels of the range's two ends. */
  start: string;
  end: string;
  /** Action, then state — the caller composes it. */
  sentence: ReactNode;
  accessibilityLabel: string;
  /** Omitted where the block is the screen itself (the goal detail). */
  onPress?: () => void;
}

/**
 * The one item a target card lifts into view (§5.13): the figure that fills the bar, the bar with
 * its pace, and a sentence that says what to do. Amounts stay visible in hidden mode, like the
 * Home budget card always has.
 */
export function FeaturedTarget(props: FeaturedTargetProps) {
  const { t } = useTranslation();
  const labels = endLabels(props.pace);
  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconBox name={props.icon} colour={props.colour} />
        <Text style={{ flex: 1 }} numberOfLines={1}>
          {props.name}
        </Text>
        <Text size="footnote" color="textMuted" numberOfLines={1}>
          {props.meta}
        </Text>
      </View>
      <AmountText
        plain
        minor={props.amount}
        currency={props.currency}
        locale={props.locale}
        size="amountLg"
        weight="semibold"
        tracking="tighter"
        style={{ marginTop: 14 }}
      />
      <Text size="footnote" color="textMuted">
        {props.of}
      </Text>
      <View style={{ marginTop: 16 }}>
        <ProgressBar
          thick
          hideable={false}
          ratio={props.ratio}
          pace={props.pace ?? undefined}
          overPace={props.tone === 'attention'}
          done={props.tone === 'done'}
        />
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ height: 16, marginTop: 6 }}
      >
        {labels.start ? (
          <Text size="caption" color="textFaint" style={{ position: 'absolute', left: 0 }}>
            {props.start}
          </Text>
        ) : null}
        {labels.today && props.pace !== null ? (
          <Text
            size="caption"
            color="textMuted"
            style={{
              position: 'absolute',
              left: `${props.pace * 100}%`,
              width: TODAY_WIDTH,
              marginLeft: -TODAY_WIDTH / 2,
              textAlign: 'center',
            }}
          >
            {t('targets.today')}
          </Text>
        ) : null}
        {labels.end ? (
          <Text size="caption" color="textFaint" style={{ position: 'absolute', right: 0 }}>
            {props.end}
          </Text>
        ) : null}
      </View>
      <Text style={{ marginTop: 12, lineHeight: 21 }}>{props.sentence}</Text>
    </>
  );
  const padding = { paddingTop: 14, paddingBottom: 16 };
  if (props.onPress === undefined) {
    return (
      <View accessible accessibilityLabel={props.accessibilityLabel} style={padding}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      onPress={props.onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, ...padding })}
    >
      {body}
    </Pressable>
  );
}
