import { betterAuth } from 'better-auth';
import { buildAuthOptions } from './auth';

/**
 * Only for `@better-auth/cli generate`, which requires a module exporting a built instance. The
 * app itself builds lazily through `auth()` so `next build` does not need the configuration.
 */
export const auth = betterAuth(buildAuthOptions());
