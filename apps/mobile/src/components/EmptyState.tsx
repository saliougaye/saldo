import { emptyState, type IconName } from '@saldo/ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { appearing, EASE, entering, useMotion } from '../theme/motion';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';
import { SecondaryButton } from './Button';
import { IconBox } from './ListRow';

/** The shape of what is missing, drawn inside each ghost. */
export type GhostKind = 'row' | 'bar' | 'chips';

export interface EmptyStateAction {
  label: string;
  onPress: () => void;
}

interface Copy {
  title: string;
  body: string;
  /** Required: an empty state with no way forward is how Budgets became unreachable. */
  action: EmptyStateAction;
}

/**
 * Three different absences, three shapes:
 * - `yet` — nothing has been created. Rare, so it gets the ghost stack and a staggered entrance.
 * - `noMatch` — things exist; a filter or the period hides them. Frequent, so it only fades in.
 * - `notFound` — the record is gone. An error, so it does not move at all.
 */
export type EmptyStateProps =
  | (Copy & { kind: 'yet'; ghost: GhostKind })
  | (Copy & { kind: 'noMatch'; icon: IconName })
  | (Copy & { kind: 'notFound'; icon: IconName });

export function EmptyState(props: EmptyStateProps) {
  const theme = useTheme();
  const pressed = useSharedValue(0);
  const yet = props.kind === 'yet';
  // The copy follows the stack in, one beat per line; the other shapes arrive as one block.
  const beat = (index: number) => (yet ? entering(index + 1) : undefined);

  return (
    <Animated.View
      entering={props.kind === 'noMatch' ? appearing : undefined}
      style={{
        alignItems: 'center',
        paddingVertical: emptyState.paddingY,
        paddingHorizontal: emptyState.paddingX,
      }}
    >
      {props.kind === 'yet' ? (
        <GhostStack kind={props.ghost} pressed={pressed} />
      ) : (
        <IconBox name={props.icon} colour={theme.palette.textMuted} />
      )}
      <Animated.View entering={beat(0)}>
        <Text
          size="headline"
          weight="medium"
          tracking="tight"
          accessibilityRole="header"
          style={{ marginTop: 16, textAlign: 'center' }}
        >
          {props.title}
        </Text>
      </Animated.View>
      <Animated.View entering={beat(1)}>
        <Text
          size="footnote"
          color="textMuted"
          style={{ marginTop: 6, textAlign: 'center', maxWidth: emptyState.bodyMaxWidth }}
        >
          {props.body}
        </Text>
      </Animated.View>
      <Animated.View entering={beat(2)} style={{ marginTop: 18 }}>
        <SecondaryButton
          label={props.action.label}
          onPress={props.action.onPress}
          // The stack is what the button creates, so pressing it pushes the stack down.
          onPressIn={
            yet
              ? () => pressed.set(withTiming(1, { duration: theme.motion.pressMs, easing: EASE }))
              : undefined
          }
          onPressOut={
            yet
              ? () =>
                  pressed.set(withTiming(0, { duration: theme.motion.snapBackMs, easing: EASE }))
              : undefined
          }
        />
      </Animated.View>
    </Animated.View>
  );
}

/** Back to front: React Native paints later siblings on top. */
const DEPTHS = [2, 1, 0] as const;

function GhostStack({ kind, pressed }: { kind: GhostKind; pressed: SharedValue<number> }) {
  return (
    <View
      // Decoration: the title says what is missing.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: emptyState.stackWidth, height: emptyState.stackHeight }}
    >
      {DEPTHS.map((depth) => (
        <GhostLayer key={depth} depth={depth} kind={kind} pressed={pressed} />
      ))}
    </View>
  );
}

function GhostLayer({
  depth,
  kind,
  pressed,
}: {
  depth: (typeof DEPTHS)[number];
  kind: GhostKind;
  pressed: SharedValue<number>;
}) {
  const theme = useTheme();
  const { reduced } = useMotion();
  const layer = emptyState.layers[depth];
  const opacity = emptyState.opacity[theme.name][depth];
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      progress.set(1);
      return;
    }
    progress.set(
      withDelay(
        depth * emptyState.staggerMs,
        withTiming(1, { duration: emptyState.enterMs, easing: EASE }),
      ),
    );
  }, [reduced, depth, progress]);

  const animated = useAnimatedStyle(() => {
    const p = progress.get();
    const q = pressed.get();
    return {
      opacity: p * opacity,
      transform: [
        { perspective: emptyState.perspective },
        { rotateX: `${emptyState.tiltX}deg` },
        { rotateZ: `${emptyState.tiltZ}deg` },
        {
          translateY:
            interpolate(p, [0, 1], [layer.enterFromY, layer.translateY]) + q * layer.pressY,
        },
        {
          scale:
            interpolate(p, [0, 1], [emptyState.enterFromScale, layer.scale]) -
            q * emptyState.pressScale,
        },
      ],
    };
  });

  return (
    <Animated.View
      testID="empty-ghost"
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          top: emptyState.ghostTop,
          height: emptyState.ghostHeight,
          borderRadius: theme.radii.input,
          borderWidth: 1,
          borderColor: theme.palette.ghostEdge,
          // The furthest ghost is dashed: the one that is not there yet.
          borderStyle: depth === 2 ? 'dashed' : 'solid',
          backgroundColor: theme.palette.ghost,
          paddingHorizontal: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          transformOrigin: 'bottom',
        },
        animated,
      ]}
    >
      <GhostInner kind={kind} />
    </Animated.View>
  );
}

const CHIP_WIDTHS = [46, 34, 58, 28] as const;

function GhostInner({ kind }: { kind: GhostKind }) {
  const theme = useTheme();
  const { ghostInk: ink, ghostInkSoft: soft, ghostEdge: edge } = theme.palette;
  const bar = (width: `${number}%` | number, colour: string, height = 6) => (
    <View style={{ width, height, borderRadius: theme.radii.pill, backgroundColor: colour }} />
  );
  const box = (
    <View
      style={{ width: 20, height: 20, borderRadius: theme.radii.iconBox, backgroundColor: soft }}
    />
  );

  if (kind === 'chips') {
    return (
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {CHIP_WIDTHS.map((width) => (
          <View
            key={width}
            style={{
              width,
              height: 14,
              borderRadius: theme.radii.pill,
              backgroundColor: soft,
              borderWidth: 1,
              borderColor: edge,
            }}
          />
        ))}
      </View>
    );
  }
  if (kind === 'bar') {
    return (
      <>
        {box}
        <View style={{ flex: 1, gap: 5 }}>
          {bar('56%', ink)}
          <View
            style={{
              height: 4,
              borderRadius: theme.radii.pill,
              backgroundColor: soft,
              overflow: 'hidden',
            }}
          >
            {bar('52%', ink, 4)}
          </View>
        </View>
      </>
    );
  }
  return (
    <>
      {box}
      <View style={{ flex: 1, gap: 5 }}>
        {bar('64%', ink)}
        {bar('40%', soft)}
      </View>
      {bar(34, ink, 7)}
    </>
  );
}
