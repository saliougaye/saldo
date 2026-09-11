import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import type { LocalAttachment } from '../../db/repositories';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

export interface AttachmentTileProps {
  row: LocalAttachment;
  width: number;
  height: number;
  onPress: () => void;
  onLongPress?: () => void;
  /** The taller tile on the detail screen says what a placeholder is; the small one has no room. */
  labelled?: boolean;
}

/**
 * One attachment, as a tile. Shared by the form strip and the transaction detail so a receipt
 * looks the same in both places — and so a PDF and a not-yet-downloaded blob keep one appearance
 * rather than one per screen (§6.6, §10).
 */
export function AttachmentTile({
  row,
  width,
  height,
  onPress,
  onLongPress,
  labelled = false,
}: AttachmentTileProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  // No local bytes means another device added it and this one has not fetched it: an inbox tile,
  // not a broken image.
  const missing = row.localUri === null;
  const isPdf = row.mimeType === 'application/pdf';
  const placeholder = missing || isPdf;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('attachments.open')}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        width,
        height,
        borderRadius: theme.radii.input,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: theme.palette.raised,
        // A hairline over the image itself, so a pale receipt still has an edge (§13).
        borderWidth: 1,
        borderColor: theme.name === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      {placeholder ? (
        <>
          <Icon
            name={missing ? 'inbox' : 'archive'}
            size={labelled ? 24 : 22}
            color={theme.palette.textMuted}
          />
          {labelled ? (
            <Text
              size="caption"
              color="textFaint"
              numberOfLines={2}
              style={{ textAlign: 'center' }}
            >
              {missing ? t('attachments.notOnThisDevice') : t('attachments.pdf')}
            </Text>
          ) : null}
        </>
      ) : (
        <Image
          source={{ uri: row.localUri ?? '' }}
          contentFit="cover"
          style={{ width: '100%', height: '100%' }}
        />
      )}
    </Pressable>
  );
}
