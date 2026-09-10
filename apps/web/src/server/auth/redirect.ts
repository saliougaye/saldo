import { ApiError } from '../http/errors';

/**
 * §18: the redirect target is allow-listed **by scheme**, which is what stops a crafted
 * `/auth/mobile?redirect_uri=…` from handing the handoff token to somewhere else.
 */
export function validateRedirectUri(uri: string, allowedSchemes: readonly string[]): string {
  if (!URL.canParse(uri)) {
    throw new ApiError(400, 'invalid_redirect_uri', 'redirect_uri is not a valid URI');
  }
  const scheme = new URL(uri).protocol.replace(/:$/, '');
  if (!allowedSchemes.includes(scheme)) {
    throw new ApiError(
      400,
      'invalid_redirect_uri',
      `redirect_uri scheme "${scheme}" is not allowed`,
    );
  }
  return uri;
}
