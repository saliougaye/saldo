import type { ReactNode } from 'react';
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
  /** A third answer, drawn between the two: for a question with two ways forward and one way out. */
  alternativeLabel?: string;
  onAlternative?: () => void;
  /** A field the question needs (the email of D32): drawn under the body, above the buttons. */
  children?: ReactNode;
  /** While the answer is in flight: the confirm spins and neither button can be pressed again. */
  busy?: boolean;
  confirmTestID?: string;
  cancelTestID?: string;
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
  alternativeLabel,
  onAlternative,
  children,
  busy = false,
  confirmTestID,
  cancelTestID,
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
          {children}
          <View style={{ gap: 8, marginTop: 4 }}>
            <PrimaryButton
              testID={confirmTestID}
              label={confirmLabel}
              loading={busy}
              onPress={onConfirm}
            />
            {alternativeLabel === undefined ? null : (
              <SecondaryButton label={alternativeLabel} disabled={busy} onPress={onAlternative} />
            )}
            <SecondaryButton
              testID={cancelTestID}
              label={cancelLabel}
              disabled={busy}
              onPress={onCancel}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
