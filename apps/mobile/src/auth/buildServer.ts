import Constants from 'expo-constants';
import { redirectUri } from './link';
import { readScheme, readServerUrl } from './serverConfig';

/**
 * The server this build talks to (§15), or null when it was built without a usable
 * `SALDO_SERVER_URL`. It is kept apart from `serverConfig` so the validation stays testable in
 * plain Node: `expo-constants` cannot load there.
 */
export const BUILD_SERVER_URL: string | null = readServerUrl(Constants.expoConfig?.extra);

/**
 * The redirect this build can actually receive: the scheme `SALDO_SCHEME` registered, not a fixed
 * `saldo://`. Same reason as above for living here — `expo-constants` cannot load in plain Node,
 * so the two functions it composes stay testable and this line does not.
 */
export const BUILD_REDIRECT_URI: string = redirectUri(readScheme(Constants.expoConfig));
