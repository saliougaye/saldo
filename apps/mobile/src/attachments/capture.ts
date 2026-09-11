import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { AttachmentMime } from './localFiles';

/** §10: the longest edge is brought down to this, which is plenty for a receipt. */
export const MAX_IMAGE_EDGE = 2000;
const JPEG_QUALITY = 0.8;

export interface CapturedFile {
  mimeType: AttachmentMime;
  bytes: Uint8Array;
  width: number | null;
  height: number | null;
}

/**
 * Re-encodes a picked image (§10): the longest edge down to 2000px and JPEG at 0.8, which also
 * **drops the EXIF** — a receipt photo otherwise carries the GPS coordinates of wherever it was
 * taken, and those would then be synced and backed up along with it.
 */
/**
 * Re-encodes a picked image (§10): the longest edge down to 2000px and JPEG at 0.8, which also
 * **drops the EXIF** — a receipt photo otherwise carries the GPS coordinates of wherever it was
 * taken, and those would then be synced and backed up along with it.
 *
 * This uses `manipulateAsync`, which the library marks deprecated in favour of the contextual
 * `ImageManipulator.manipulate(...).renderAsync()`. That replacement **never settles** here: a
 * traced run timed out after eight seconds on a 64px data URI, with the module loaded, the context
 * built and a resize queued. A deprecation warning is a smaller problem than an attachment flow
 * that hangs with no file, no row and no error, so the old call stands until the new one works.
 *
 * The source dimensions come from the picker, which already knows them.
 */
export async function compressImage(
  uri: string,
  source: { width: number; height: number },
): Promise<CapturedFile> {
  const longestEdge = Math.max(source.width, source.height);
  const scale = longestEdge > MAX_IMAGE_EDGE ? MAX_IMAGE_EDGE / longestEdge : 1;
  const actions =
    scale === 1
      ? []
      : [
          {
            resize: {
              width: Math.round(source.width * scale),
              height: Math.round(source.height * scale),
            },
          },
        ];
  const saved = await manipulateAsync(uri, actions, {
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
  });
  return {
    mimeType: 'image/jpeg',
    bytes: new File(saved.uri).bytesSync(),
    width: saved.width,
    height: saved.height,
  };
}

/** The camera. Null when the user cancelled or refused the permission. */
export async function captureFromCamera(): Promise<CapturedFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ quality: 1, exif: false });
  const asset = result.canceled ? undefined : result.assets[0];
  return asset === undefined ? null : compressImage(asset.uri, asset);
}

/** The photo library. */
export async function captureFromLibrary(): Promise<CapturedFile | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 1,
    exif: false,
    mediaTypes: ['images'],
  });
  const asset = result.canceled ? undefined : result.assets[0];
  return asset === undefined ? null : compressImage(asset.uri, asset);
}

/** A PDF, taken as it is: there is nothing to compress and nothing to strip. */
export async function captureDocument(): Promise<CapturedFile | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
  });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (asset === undefined) return null;
  return {
    mimeType: 'application/pdf',
    bytes: new File(asset.uri).bytesSync(),
    width: null,
    height: null,
  };
}
