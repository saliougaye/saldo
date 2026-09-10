import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

export interface SwipeRowProps {
  children: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  onPress: () => void;
  editLabel: string;
  deleteLabel: string;
}

/**
 * §5.12: drag right past 70px edits, drag left past it deletes, travel is capped at 120px and a
 * release below the threshold snaps back in 240ms. The reveal's opacity tracks `|dx| / 70`.
 */
export function SwipeRow({
  children,
  onEdit,
  onDelete,
  onPress,
  editLabel,
  deleteLabel,
}: SwipeRowProps) {
  const theme = useTheme();
  const { swipeActionThreshold, swipeMaxTravel, tapSlop } = theme.gestures;
  const dx = useSharedValue(0);

  const snapBack = () => {
    dx.value = withTiming(0, { duration: theme.motion.snapBackMs });
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      dx.value = Math.max(-swipeMaxTravel, Math.min(swipeMaxTravel, event.translationX));
    })
    .onEnd(() => {
      if (dx.value >= swipeActionThreshold) runOnJS(onEdit)();
      else if (dx.value <= -swipeActionThreshold) runOnJS(onDelete)();
      runOnJS(snapBack)();
    });

  const tap = Gesture.Tap()
    .maxDistance(tapSlop)
    .onEnd(() => runOnJS(onPress)());

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dx.value }] }));
  const editStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, dx.value) / swipeActionThreshold),
  }));
  const deleteStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, -dx.value) / swipeActionThreshold),
  }));

  return (
    <View>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, editStyle]}>
          <Icon name="pencil" size={16} color={theme.palette.textMuted} />
          <Text size="footnote" color="textMuted">
            {editLabel}
          </Text>
        </Animated.View>
        <Animated.View
          style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, deleteStyle]}
        >
          <Text size="footnote" color="accent">
            {deleteLabel}
          </Text>
          <Icon name="trash" size={16} color={theme.palette.accent} />
        </Animated.View>
      </View>
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <Animated.View style={[{ backgroundColor: theme.palette.surface }, rowStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
