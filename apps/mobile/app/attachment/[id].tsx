import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { removeAttachment } from '../../src/attachments/attachmentService';
import { readBytes, storeBytes } from '../../src/attachments/localFiles';
import { useServer } from '../../src/auth/ServerProvider';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useAttachment } from '../../src/db/hooks';
import { downloadBlob } from '../../src/sync/blobSync';
import { Icon } from '../../src/theme/Icon';
import { Text } from '../../src/theme/Text';

/**
 * §6.28: black full-screen, a close button, and a delete. Deliberately not a gallery — the swipe
 * between attachments and the pinch zoom of the design are not in the POC, and a viewer that
 * pretends to have them would be worse than one that does not.
 */
export default function AttachmentViewer() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const repos = useRepositories();
  const { id } = useLocalSearchParams<{ id: string }>();
  const attachment = useAttachment(id);
  const [confirming, setConfirming] = useState(false);
  const { api } = useServer();
  const [fetching, setFetching] = useState(false);

  // §10: the row can arrive from another device long before its bytes do, so opening the viewer is
  // what asks for them. It runs once per mount and stays quiet when it cannot: offline, or a
  // server that keeps no attachments, both leave the row exactly as it was.
  const missing = attachment !== null && attachment.localUri === null;
  useEffect(() => {
    if (!missing || api === null) return;
    let cancelled = false;
    setFetching(true);
    void downloadBlob({ repos, api, readBytes, storeBytes }, id)
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [missing, api, repos, id]);

  const button = (name: 'x' | 'trash', label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      onPress={onPress}
      style={{
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.14)',
      }}
    >
      <Icon name={name} size={20} color="#ffffff" />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <View
        style={{
          position: 'absolute',
          zIndex: 1,
          top: insets.top + 8,
          left: 16,
          right: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        {button('x', t('common.close'), () => router.back())}
        {attachment === null
          ? null
          : button('trash', t('common.delete'), () => setConfirming(true))}
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        {attachment === null ? (
          <Text color="textMuted">{t('attachments.missing')}</Text>
        ) : attachment.localUri === null ? (
          // The row synced but this device never fetched the bytes, or the server has none.
          <Text color="textMuted">
            {fetching ? t('common.loading') : t('attachments.notOnThisDevice')}
          </Text>
        ) : attachment.mimeType === 'application/pdf' ? (
          <View style={{ alignItems: 'center', gap: 12 }}>
            <Icon name="archive" size={48} color="#ffffff" />
            <Text color="textMuted">{t('attachments.pdf')}</Text>
          </View>
        ) : (
          <Image
            source={{ uri: attachment.localUri }}
            contentFit="contain"
            style={{ width: '100%', height: '100%' }}
          />
        )}
      </View>

      <ConfirmDialog
        visible={confirming}
        title={t('attachments.deleteTitle')}
        body={t('attachments.deleteBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          setConfirming(false);
          removeAttachment(repos, id);
          router.back();
        }}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}
