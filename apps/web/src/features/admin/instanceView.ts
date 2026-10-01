import type { AttachmentStorageKind } from '../../server/env';
import type { AdminMessage } from './message';

/** What Istanza reads: the build (`version.ts`, the sync schema) and the environment (`env()`). */
export interface InstanceInput {
  version: string;
  apiVersion: number;
  schemaVersion: number;
  storageKind: AttachmentStorageKind;
  publicUrl: string;
  defaultTimeZone: string;
}

export interface InstanceRowView {
  id: 'version' | 'sync' | 'storage' | 'address' | 'timeZone';
  labelKey: string;
  value: AdminMessage;
  subtitle: AdminMessage | null;
}

const STORAGE_KEYS: Record<AttachmentStorageKind, string> = {
  none: 'admin.instance.storageNone',
  fs: 'admin.instance.storageFs',
  s3: 'admin.instance.storageS3',
  'vercel-blob': 'admin.instance.storageVercelBlob',
};

/** Admin → Istanza (§17.1.7): read-only rows, no panel. */
export function instanceRows(input: InstanceInput): InstanceRowView[] {
  return [
    {
      id: 'version',
      labelKey: 'admin.instance.version',
      value: { text: input.version },
      subtitle: null,
    },
    {
      id: 'sync',
      labelKey: 'admin.instance.sync',
      value: {
        key: 'admin.instance.syncValue',
        vars: { api: input.apiVersion, schema: input.schemaVersion },
      },
      subtitle: null,
    },
    {
      id: 'storage',
      labelKey: 'admin.instance.storage',
      value: { key: STORAGE_KEYS[input.storageKind] },
      subtitle: { text: `ATTACHMENT_STORAGE=${input.storageKind}` },
    },
    {
      id: 'address',
      labelKey: 'admin.instance.address',
      value: { text: input.publicUrl },
      subtitle: null,
    },
    {
      id: 'timeZone',
      labelKey: 'admin.instance.timeZone',
      value: { text: input.defaultTimeZone },
      subtitle: { key: 'admin.instance.timeZoneNote' },
    },
  ];
}
