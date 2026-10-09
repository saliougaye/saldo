import type { CDPSession, Page } from '@playwright/test';

/** What the virtual authenticator stores for one passkey; `credential` is CDP's own shape. */
export interface StoredCredential {
  credentialId: string;
  isResidentCredential: boolean;
  rpId: string;
  privateKey: string;
  userHandle?: string;
  signCount: number;
}

export interface VirtualAuthenticator {
  credentials: () => Promise<StoredCredential[]>;
  add: (credential: StoredCredential) => Promise<void>;
  /** Makes the next ceremony fail as if the person pressed «Cancel» on the browser's prompt. */
  setUserVerified: (verified: boolean) => Promise<void>;
  remove: () => Promise<void>;
}

/**
 * A platform authenticator that approves every ceremony on its own, through Chromium's DevTools
 * WebAuthn domain. It lives as long as the page's CDP session, so a test that signs in again later
 * re-adds the credentials it saved with `credentials()`.
 */
export async function addVirtualAuthenticator(page: Page): Promise<VirtualAuthenticator> {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return {
    credentials: async () => {
      const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
      return credentials as StoredCredential[];
    },
    add: async (credential) => {
      await cdp.send('WebAuthn.addCredential', { authenticatorId, credential });
    },
    setUserVerified: async (verified) => {
      await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: verified });
    },
    remove: async () => {
      await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
    },
  };
}
