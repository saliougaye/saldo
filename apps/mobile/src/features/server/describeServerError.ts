import type { TFunction } from 'i18next';
import { ApiClientError } from '../../net/apiClient';

/** Error codes with their own wording; anything else falls back to the message. */
export const SERVER_ERROR_KEYS: Record<string, string> = {
  unreachable: 'sync.unreachable',
  not_saldo: 'sync.notSaldo',
  cancelled: 'sync.cancelled',
  schema_too_old: 'sync.schemaTooOld',
  schema_too_new: 'sync.schemaTooNew',
  registration_closed: 'sync.registrationClosed',
  display_name_required: 'sync.nameRequired',
  foreign_device_data: 'sync.foreignDeviceData',
};

export function describeServerError(t: TFunction, caught: unknown): string {
  const code = caught instanceof ApiClientError ? caught.code : null;
  const key = code === null ? undefined : SERVER_ERROR_KEYS[code];
  if (key !== undefined) return t(key);
  return caught instanceof Error ? caught.message : t('sync.unreachable');
}
