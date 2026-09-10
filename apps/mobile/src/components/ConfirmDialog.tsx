import { Modal, View } from 'react-native';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';
import { PrimaryButton, SecondaryButton } from './Button';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Centered dialog of §6.26, scrim 0.6. */
export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          backgroundColor: theme.palette.dialogScrim,
        }}
      >
        <View
          style={{
            width: '100%',
            gap: 12,
            padding: 20,
            borderRadius: theme.radii.dialog,
            backgroundColor: theme.palette.surface,
          }}
        >
          <Text size="headline" weight="semibold" tracking="tight">
            {title}
          </Text>
          {body === undefined ? null : <Text color="textMuted">{body}</Text>}
          <View style={{ gap: 8, marginTop: 4 }}>
            <PrimaryButton label={confirmLabel} onPress={onConfirm} />
            <SecondaryButton label={cancelLabel} onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
