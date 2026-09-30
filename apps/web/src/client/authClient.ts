'use client';

import { passkeyClient } from '@better-auth/passkey/client';
import { magicLinkClient, oneTimeTokenClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/**
 * Browser client for the `/auth/mobile` page. Same-origin, so it needs no `baseURL`: the page is
 * served by the very server the passkey belongs to, which is also what makes the WebAuthn origin
 * check pass.
 */
export const authClient = createAuthClient({
  plugins: [passkeyClient(), oneTimeTokenClient(), magicLinkClient()],
});
