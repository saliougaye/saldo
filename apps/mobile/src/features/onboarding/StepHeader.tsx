import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { BackButton } from '../../components/ScreenHeader';
import { stepEntering } from '../../theme/motion';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { StepSegments } from './StepSegments';

/** The blocks of a step, in the order they arrive. Content below the header starts at `content`. */
export const CHUNK = { segments: 0, title: 1, body: 2, content: 3 } as const;

export interface StepHeaderProps {
  /** Omitted on the chooser and the welcome screen, which are not numbered (§6.29). */
  step?: { current: number; total: number };
  title: string;
  body: string;
  /** Hides the back affordance where the screen is the first of its stack. */
  back?: boolean;
}

/**
 * The top of every onboarding screen (§6.29): back, the 2px segments, the title one word at a
 * time, the body. Each block arrives after the previous one; the Stack's fade takes the old
 * screen away. Pair with {@link StepChunk} for the content underneath.
 */
export function StepHeader({ step, title, body, back = true }: StepHeaderProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const words = title.split(' ');
  const size = theme.fontSize.display;
  return (
    <View style={{ gap: 12 }}>
      {back ? <BackButton /> : null}
      {step === undefined ? null : (
        <Animated.View entering={stepEntering(CHUNK.segments)}>
          <StepSegments
            current={step.current}
            total={step.total}
            label={t('onboarding.step', { current: step.current, total: step.total })}
          />
        </Animated.View>
      )}
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={title}
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          // A word's worth of space at this size: the row lays the words out, not the text.
          columnGap: Math.round(size * 0.24),
          marginTop: step === undefined ? 12 : 4,
        }}
      >
        {words.map((word, index) => (
          <Animated.View
            // Words repeat ("il", "di") and never reorder: the position is the identity.
            // biome-ignore lint/suspicious/noArrayIndexKey: positional by nature
            key={`${index}-${word}`}
            testID="step-word"
            entering={stepEntering(CHUNK.title, index)}
          >
            <Text size="display" weight="semibold" tracking="tighter">
              {word}
            </Text>
          </Animated.View>
        ))}
      </View>
      <Animated.View entering={stepEntering(CHUNK.body)}>
        <Text color="textMuted">{body}</Text>
      </Animated.View>
    </View>
  );
}

export interface StepChunkProps {
  /** Position in the entrance; content starts at `CHUNK.content`. */
  index?: number;
  children: ReactNode;
}

/** A block of step content arriving after the header. */
export function StepChunk({ index = CHUNK.content, children }: StepChunkProps) {
  return <Animated.View entering={stepEntering(index)}>{children}</Animated.View>;
}
