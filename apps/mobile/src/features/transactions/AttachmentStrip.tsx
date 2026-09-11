import { MAX_ATTACHMENTS_PER_TRANSACTION } from '@saldo/core';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { addAttachment, removeAttachment } from '../../attachments/attachmentService';
import {
  type CapturedFile,
  captureDocument,
  captureFromCamera,
  captureFromLibrary,
} from '../../attachments/capture';
import { AttachmentTooLargeError } from '../../attachments/localFiles';
import { ListRow } from '../../components/ListRow';
import { Sheet } from '../../components/Sheet';
import { useRepositories } from '../../db/DatabaseProvider';
import { useAttachments } from '../../db/hooks';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

const TILE = 72;

/**
 * §6.6 and §6.16: the attachments of one transaction, as tiles, with the ways to add one. The
 * transaction id is required and known before the row exists — the caller generates it — so
 * attaching works the same on a new transaction as on a saved one.
 */
export function AttachmentStrip({ transactionId }: { transactionId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const repos = useRepositories();
  const rows = useAttachments(transactionId);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Held until the sheet has actually gone: a native picker opened while it is still dismissing
  // never appears (see `Sheet.onDismissed`).
  const pending = useRef<(() => Promise<CapturedFile | null>) | null>(null);
  const full = rows.length >= MAX_ATTACHMENTS_PER_TRANSACTION;

  const choose = (capture: () => Promise<CapturedFile | null>) => () => {
    pending.current = capture;
    setError(null);
    setSourceOpen(false);
  };

  const runPending = useCallback(() => {
    const capture = pending.current;
    pending.current = null;
    if (capture === null) return;
    void (async () => {
      try {
        const captured = await capture();
        if (captured === null) return;
        await addAttachment(repos, transactionId, captured);
      } catch (caught) {
        setError(
          caught instanceof AttachmentTooLargeError
            ? t('attachments.tooLarge')
            : t('attachments.failed'),
        );
      }
    })();
  }, [repos, transactionId, t]);

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>{t('txForm.attachments')}</Text>
        <Text size="footnote" color="textFaint">
          {t('attachments.count', {
            count: rows.length,
            max: MAX_ATTACHMENTS_PER_TRANSACTION,
          })}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {rows.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              accessibilityLabel={t('attachments.open')}
              onPress={() => router.push({ pathname: '/attachment/[id]', params: { id: row.id } })}
              onLongPress={() => removeAttachment(repos, row.id)}
              style={{
                width: TILE,
                height: TILE,
                borderRadius: theme.radii.card,
                overflow: 'hidden',
                backgroundColor: theme.palette.raised,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {row.mimeType === 'application/pdf' || row.localUri === null ? (
                // No local bytes yet means another device added it and this one has not fetched
                // it — an inbox tile, not a broken image.
                <Icon
                  name={row.localUri === null ? 'inbox' : 'archive'}
                  size={22}
                  color={theme.palette.textMuted}
                />
              ) : (
                <Image
                  source={{ uri: row.localUri }}
                  contentFit="cover"
                  style={{ width: TILE, height: TILE }}
                />
              )}
            </Pressable>
          ))}

          {full ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('attachments.add')}
              onPress={() => setSourceOpen(true)}
              style={{
                width: TILE,
                height: TILE,
                borderRadius: theme.radii.card,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: theme.palette.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="plus" size={20} color={theme.palette.textMuted} />
            </Pressable>
          )}
        </View>
      </ScrollView>

      {error === null ? null : (
        <Text size="footnote" color="accent">
          {error}
        </Text>
      )}

      <Sheet
        visible={sourceOpen}
        onClose={() => {
          pending.current = null;
          setSourceOpen(false);
        }}
        onDismissed={runPending}
        title={t('attachments.add')}
      >
        <ListRow title={t('attachments.camera')} onPress={choose(captureFromCamera)} />
        <ListRow title={t('attachments.library')} onPress={choose(captureFromLibrary)} />
        <ListRow title={t('attachments.document')} onPress={choose(captureDocument)} />
      </Sheet>
    </View>
  );
}
