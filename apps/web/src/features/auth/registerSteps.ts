/** §17.1.7, auth pages: one decision per screen, the invite only where the server asks for one. */
export type RegisterStep = 'identity' | 'invite' | 'passkey';

export function registerSteps(requiresInvite: boolean): RegisterStep[] {
  return requiresInvite ? ['identity', 'invite', 'passkey'] : ['identity', 'passkey'];
}

export function stepAfter(
  steps: readonly RegisterStep[],
  current: RegisterStep,
): RegisterStep | null {
  return steps[steps.indexOf(current) + 1] ?? null;
}

export function stepBefore(
  steps: readonly RegisterStep[],
  current: RegisterStep,
): RegisterStep | null {
  const index = steps.indexOf(current);
  return index <= 0 ? null : (steps[index - 1] ?? null);
}

/** Which field caused a refusal, by the code the server sent. */
const OWNER: Record<string, RegisterStep> = {
  email_taken: 'identity',
  email_required: 'identity',
  display_name_required: 'identity',
  invalid_invite: 'invite',
};

/**
 * «Ogni errore sta nel passo dove nasce» (§17.1.7). Anything the steps did not cause — a closed
 * server, a cancelled ceremony, a rate limit — belongs where the ceremony runs, which is the last step.
 */
export function stepForErrorCode(
  code: string | undefined,
  steps: readonly RegisterStep[],
): RegisterStep {
  const owner = code === undefined ? undefined : OWNER[code];
  if (owner !== undefined && steps.includes(owner)) return owner;
  if (owner !== undefined) return steps[0] ?? 'identity';
  return steps[steps.length - 1] ?? 'passkey';
}
