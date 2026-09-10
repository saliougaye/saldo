import { expoClient } from '@better-auth/expo/client';
import { oneTimeTokenClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

export type ServerAuthClient = ReturnType<typeof createServerAuthClient>;

/**
 * One client per server URL. The session lives in SecureStore under a prefix that includes the
 * server, so pointing the app at a second server cannot reuse the first one's session (§9.3 step 8).
 */
export function createServerAuthClient(serverUrl: string) {
  return createAuthClient({
    baseURL: serverUrl,
    plugins: [
      expoClient({
        scheme: 'saldo',
        storagePrefix: `saldo_${serverUrl.replace(/[^A-Za-z0-9]/g, '_')}`,
        storage: SecureStore,
      }),
      oneTimeTokenClient(),
    ],
  });
}
