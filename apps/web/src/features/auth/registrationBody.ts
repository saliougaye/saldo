/**
 * The one string `@better-auth/passkey` carries from the browser into `resolveUser`. This is the
 * browser's half: nothing under `src/server` may be bundled for a client, so the shape is written
 * twice and `registrationBody.test.ts` is what keeps the two spellings identical.
 */
export function registrationContextJson(value: {
  name: string;
  email: string;
  invite: string | null;
}): string {
  return JSON.stringify({
    name: value.name,
    email: value.email,
    invite: value.invite ?? undefined,
  });
}
