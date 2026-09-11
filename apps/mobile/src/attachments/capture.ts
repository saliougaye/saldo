import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
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
async function compressImage(uri: string): Promise<CapturedFile> {
  const context = ImageManipulator.manipulate(uri);
  const image = await context.renderAsync();
  const longestEdge = Math.max(image.width, image.height);
  if (longestEdge > MAX_IMAGE_EDGE) {
    const scale = MAX_IMAGE_EDGE / longestEdge;
    context.resize({
      width: Math.round(image.width * scale),
      height: Math.round(image.height * scale),
    });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
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
  return asset === undefined ? null : compressImage(asset.uri);
}

/** The photo library. */
export async function captureFromLibrary(): Promise<CapturedFile | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 1,
    exif: false,
    mediaTypes: ['images'],
  });
  const asset = result.canceled ? undefined : result.assets[0];
  return asset === undefined ? null : compressImage(asset.uri);
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
