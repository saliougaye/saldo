import { type OsPermission, type PermissionState, permissionState } from '@saldo/core';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

/** The rows that are OS permissions; the app lock is a setting and is not in here. */
export type SystemPermission = 'notifications' | 'camera';
export const SYSTEM_PERMISSIONS: readonly SystemPermission[] = ['notifications', 'camera'];

const READ: Record<SystemPermission, () => Promise<OsPermission>> = {
  notifications: () => Notifications.getPermissionsAsync(),
  camera: () => ImagePicker.getCameraPermissionsAsync(),
};

const REQUEST: Record<SystemPermission, () => Promise<OsPermission>> = {
  notifications: () => Notifications.requestPermissionsAsync(),
  camera: () => ImagePicker.requestCameraPermissionsAsync(),
};

/** Shows the system prompt. Only «Attiva» calls this: iOS shows the prompt once per install. */
export async function requestSystemPermission(kind: SystemPermission): Promise<OsPermission> {
  const response = await REQUEST[kind]();
  return { granted: response.granted, canAskAgain: response.canAskAgain };
}

/** The app's page in the system settings, the only place a denied permission comes back from. */
export function openSystemSettings(): void {
  void Linking.openSettings();
}

/**
 * What the OS says about each permission, read on mount and again whenever the app returns to the
 * foreground — the way back from `openSystemSettings`. Null until the first read lands.
 */
export function useSystemPermissions(): {
  states: Record<SystemPermission, PermissionState> | null;
  refresh: () => Promise<void>;
} {
  const [states, setStates] = useState<Record<SystemPermission, PermissionState> | null>(null);

  const refresh = useCallback(async () => {
    const [notifications, camera] = await Promise.all([READ.notifications(), READ.camera()]);
    setStates({ notifications: permissionState(notifications), camera: permissionState(camera) });
  }, []);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return { states, refresh };
}
