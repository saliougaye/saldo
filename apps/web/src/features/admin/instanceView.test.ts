import { describe, expect, it } from 'vitest';
import { type InstanceInput, instanceRows } from './instanceView';

const input: InstanceInput = {
  version: '0.1.0',
  apiVersion: 1,
  schemaVersion: 3,
  storageKind: 'fs',
  publicUrl: 'https://saldo.example.com',
  defaultTimeZone: 'Europe/Rome',
};

describe('instanceRows', () => {
  it('gives the five rows of Istanza in order', () => {
    expect(instanceRows(input).map((row) => row.id)).toEqual([
      'version',
      'sync',
      'storage',
      'address',
      'timeZone',
    ]);
  });

  it('shows the version, the address and the zone as literals, never translated', () => {
    const rows = instanceRows(input);
    expect(rows[0]).toMatchObject({ labelKey: 'admin.instance.version', value: { text: '0.1.0' } });
    expect(rows[3]).toMatchObject({
      labelKey: 'admin.instance.address',
      value: { text: 'https://saldo.example.com' },
    });
    expect(rows[4]).toMatchObject({
      labelKey: 'admin.instance.timeZone',
      value: { text: 'Europe/Rome' },
      subtitle: { key: 'admin.instance.timeZoneNote' },
    });
  });

  it('reads the API and the sync schema on one row', () => {
    expect(instanceRows(input)[1]).toMatchObject({
      labelKey: 'admin.instance.sync',
      value: { key: 'admin.instance.syncValue', vars: { api: 1, schema: 3 } },
    });
  });

  it('names the storage driver and the setting that chose it', () => {
    expect(instanceRows(input)[2]).toMatchObject({
      labelKey: 'admin.instance.storage',
      value: { key: 'admin.instance.storageFs' },
      subtitle: { text: 'ATTACHMENT_STORAGE=fs' },
    });
    expect(instanceRows({ ...input, storageKind: 'none' })[2]).toMatchObject({
      value: { key: 'admin.instance.storageNone' },
      subtitle: { text: 'ATTACHMENT_STORAGE=none' },
    });
    expect(instanceRows({ ...input, storageKind: 's3' })[2]?.value).toEqual({
      key: 'admin.instance.storageS3',
    });
    expect(instanceRows({ ...input, storageKind: 'vercel-blob' })[2]?.value).toEqual({
      key: 'admin.instance.storageVercelBlob',
    });
  });
});
