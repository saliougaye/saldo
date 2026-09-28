/**
 * The authenticators an AAGUID names, for the handful people actually hold. There is a community list
 * of several hundred; this is a short, hand-kept map on purpose — it ships no third-party data file,
 * needs no update mechanism, and an unknown value simply shows «Passkey» (`web.passkeys.unknownProvider`).
 *
 * Values from the FIDO metadata service and passkeys.dev's public AAGUID list.
 */
const PROVIDERS: Record<string, string> = {
  'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'iCloud Keychain',
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google Password Manager',
  'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome on Mac',
  'bada5566-a7aa-401f-bd96-45619a55120d': '1Password',
  'd548826e-79b4-db40-a3d8-11116f7e8349': 'Bitwarden',
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello',
  '9ddd1817-af5a-4672-a2b9-3e3dd95000a9': 'Windows Hello',
  '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello',
  'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': 'iCloud Keychain (managed)',
  '531126d6-ae23-4d10-8f07-64c3db11d3c5': 'Samsung Pass',
  'b5397666-4885-aa6b-cebf-e52262a439a2': 'Chromium on Linux',
};

/** The authenticator this passkey lives in, or null when the AAGUID says nothing recognisable. */
export function passkeyProvider(aaguid: string | null | undefined): string | null {
  if (aaguid === null || aaguid === undefined) return null;
  return PROVIDERS[aaguid.trim().toLowerCase()] ?? null;
}
