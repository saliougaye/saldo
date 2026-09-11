import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { leaving, toastEntering } from '../theme/motion';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastState {
  message: string;
  action?: ToastAction;
}

export interface ToastValue {
  /** §6.27: 4s, or 5s when there is an undo action. */
  show(message: string, action?: ToastAction): void;
}

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, action?: ToastAction) => {
      if (timer.current !== null) clearTimeout(timer.current);
      setToast(action === undefined ? { message } : { message, action });
      timer.current = setTimeout(
        () => setToast(null),
        action === undefined ? theme.motion.toastMs : theme.motion.undoToastMs,
      );
    },
    [theme.motion.toastMs, theme.motion.undoToastMs],
  );

  const value = useMemo<ToastValue>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast === null ? null : (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: theme.layout.screenPaddingX,
            right: theme.layout.screenPaddingX,
            bottom: theme.layout.toastBottom + insets.bottom,
          }}
        >
          <Animated.View
            entering={toastEntering}
            exiting={leaving}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              borderRadius: theme.radii.button,
              backgroundColor: theme.palette.raised,
              borderWidth: 1,
              borderColor: theme.palette.border,
            }}
          >
            <Text style={{ flex: 1 }} numberOfLines={2}>
              {toast.message}
            </Text>
            {toast.action === undefined ? null : (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => {
                  toast.action?.onPress();
                  setToast(null);
                }}
              >
                <Text color="accent" weight="medium">
                  {toast.action.label}
                </Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const value = useContext(ToastContext);
  if (value === null) throw new Error('useToast must be used inside a ToastProvider');
  return value;
}
