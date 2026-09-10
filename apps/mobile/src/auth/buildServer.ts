import Constants from 'expo-constants';
import { readServerUrl } from './serverConfig';

/**
 * The server this build talks to (§15), or null when it was built without a usable
 * `SALDO_SERVER_URL`. It is kept apart from `serverConfig` so the validation stays testable in
 * plain Node: `expo-constants` cannot load there.
 */
export const BUILD_SERVER_URL: string | null = readServerUrl(Constants.expoConfig?.extra);
