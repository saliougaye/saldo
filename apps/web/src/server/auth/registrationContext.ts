import { z } from 'zod';

/**
 * `@better-auth/passkey` passes exactly one optional string from the client into `resolveUser` and
 * stores it on the challenge, so the same value reaches `afterVerification`. That single channel
 * has to carry both things the registration form collects, which is why it is JSON.
 */
export interface RegistrationContext {
  name: string;
  invite: string | null;
}

const schema = z.object({
  name: z.string(),
  invite: z.string().optional(),
});

/**
 * The canonical encoder. `MobileAuth.tsx` is a client component and deliberately does not import
 * it — nothing from `src/server` belongs in a bundle sent to a browser — so it writes the same
 * JSON by hand, and `registrationContext.test.ts` pins the literal shape both must produce.
 */
export function encodeRegistrationContext(value: {
  name: string;
  invite?: string | undefined;
}): string {
  return JSON.stringify({ name: value.name, invite: value.invite });
}

/**
 * Never throws: this reads client-supplied data, and every way of getting it wrong has to end in
 * the same place — an empty name and no code, which the caller refuses like any other bad input.
 * A value that is not JSON is read as a bare display name, which is what the form sent before
 * invites existed.
 */
export function readRegistrationContext(context: string | null | undefined): RegistrationContext {
  if (context === null || context === undefined) return { name: '', invite: null };
  let raw: unknown;
  try {
    raw = JSON.parse(context);
  } catch {
    return { name: context.trim(), invite: null };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { name: '', invite: null };
  return { name: parsed.data.name.trim(), invite: parsed.data.invite?.trim() ?? null };
}
