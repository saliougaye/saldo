import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Form sheets take the taller slide-up timing of §13. */
  tall?: boolean;
}

/**
 * Bottom sheet of §6: 14px top radius, a 36×4 handle and a 0.55 scrim. Built on `Modal` so it
 * works over any screen without a host provider; `@gorhom/bottom-sheet` is reserved for the
 * gesture-driven sheets that need snap points.
 */
export function Sheet({ visible, onClose, title, children, tall = false }: SheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="close"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: theme.palette.scrim }}
      />
      <View
        style={{
          backgroundColor: theme.palette.surface,
          borderTopLeftRadius: theme.radii.sheet,
          borderTopRightRadius: theme.radii.sheet,
          paddingBottom: insets.bottom + 16,
          maxHeight: tall ? '92%' : '80%',
        }}
      >
        <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <View
            style={{
              width: theme.layout.sheetHandleWidth,
              height: theme.layout.sheetHandleHeight,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.palette.borderStrong,
            }}
          />
        </View>
        {title === undefined ? null : (
          <Text
            size="headline"
            weight="semibold"
            tracking="tight"
            style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}
          >
            {title}
          </Text>
        )}
        <View style={{ paddingHorizontal: theme.layout.cardPadding, gap: 10 }}>{children}</View>
      </View>
    </Modal>
  );
}
