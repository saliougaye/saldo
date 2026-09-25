import Constants from 'expo-constants';
import { redirectUri } from './link';
import { readScheme } from './serverConfig';

/**
 * The redirect this build can actually receive: the scheme `SALDO_SCHEME` registered, not a fixed
 * `saldo://`. It lives apart from `serverConfig` because `expo-constants` cannot load in plain
 * Node, so the two functions it composes stay testable and this line does not.
 */
export const BUILD_REDIRECT_URI: string = redirectUri(readScheme(Constants.expoConfig));
