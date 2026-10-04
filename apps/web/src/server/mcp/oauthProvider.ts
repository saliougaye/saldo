import { oauthProvider } from '@better-auth/oauth-provider';
import { hashOAuthToken } from './oauthToken';
import { mcpResourceUrl, OAUTH_SCOPES } from './urls';

/** §17.4.1 (D39). */
export const ACCESS_TOKEN_SECONDS = 60 * 60;
export const REFRESH_TOKEN_SECONDS = 60 * 60 * 24 * 180;
export const REFRESH_REUSE_SECONDS = 30;
export const REGISTRATIONS_PER_MINUTE_PER_IP = 1;

/**
 * Saldo as the authorization server of its own `/mcp`. See the plan's decisions 3–8 for why each
 * option is what it is; in short: opaque tokens only, stored with our hash; public clients that
 * register themselves, one per minute per IP; exact redirect matching; one resource; nobody manages
 * clients or resources through the plugin's CRUD.
 */
export function mcpOAuthProvider(publicUrl: string) {
  return oauthProvider({
    scopes: [...OAUTH_SCOPES],
    loginPage: '/login',
    consentPage: '/oauth/consent',
    disableJwtPlugin: true,
    grantTypes: ['authorization_code', 'refresh_token'],
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    accessTokenExpiresIn: ACCESS_TOKEN_SECONDS,
    refreshTokenExpiresIn: REFRESH_TOKEN_SECONDS,
    refreshTokenReuseInterval: REFRESH_REUSE_SECONDS,
    storeTokens: { hash: async (token: string) => hashOAuthToken(token) },
    resources: [mcpResourceUrl(publicUrl)],
    enforcePerClientResources: false,
    // RFC 9700 exact match; the plugin's default would let a loopback port vary.
    validateRedirectUri: (uri: string, registered: readonly string[]) => registered.includes(uri),
    clientPrivileges: async () => false,
    resourcePrivileges: async () => false,
    rateLimit: { register: { window: 60, max: REGISTRATIONS_PER_MINUTE_PER_IP } },
  });
}
