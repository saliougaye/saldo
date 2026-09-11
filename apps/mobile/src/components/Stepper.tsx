import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface StepperProps {
  /** Zero-based index of the step being shown. */
  step: number;
  total: number;
  /** What this step is asking for, next to the count. */
  label: string;
}

/**
 * Where you are in a multi-step form. A wizard without this is a form that keeps changing under
 * you: the bar says how much is left, and the label says what the step is for.
 */
export function Stepper({ step, total, label }: StepperProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const segments = Array.from({ length: total }, (_, index) => `segment-${index + 1}`);
  return (
    <View
      style={{ gap: 8 }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: step + 1 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text size="footnote" color="textMuted" style={{ flex: 1 }} numberOfLines={1}>
          {label}
        </Text>
        <Text size="caption" color="textFaint" tabular>
          {t('common.stepOf', { step: step + 1, total })}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {segments.map((name, index) => (
          <View
            // The segments are fixed positions in a bar, so the position is the identity.
            key={name}
            style={{
              flex: 1,
              height: theme.layout.progressHeight,
              borderRadius: theme.radii.pill,
              backgroundColor: index <= step ? theme.palette.accent : theme.palette.track,
            }}
          />
        ))}
      </View>
    </View>
  );
}
