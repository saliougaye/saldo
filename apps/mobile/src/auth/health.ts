import { z } from 'zod';

/** §9.3 step 1: what `GET /api/health` must answer for an address to be a Saldo server. */
export const healthSchema = z.object({
  app: z.literal('saldo'),
  apiVersion: z.number(),
  schemaVersion: z.number(),
  version: z.string(),
  registrationAllowed: z.boolean(),
  /** §10. Defaulted rather than required, so a server from before this field stays readable. */
  attachmentsEnabled: z.boolean().default(false),
});

export type ServerHealth = z.infer<typeof healthSchema>;

export type HealthReading =
  | { kind: 'saldo'; health: ServerHealth }
  /** Nothing answered, or a server errored: worth «Riprova» on the same address. */
  | { kind: 'unreachable' }
  /** Something answered, and it is not Saldo: the address is the problem, not the network. */
  | { kind: 'not_saldo' };

/**
 * Tells the three apart from the status and the body. A 5xx counts as unreachable because a Saldo
 * behind a reverse proxy that is down answers 502/503, and trying again later is the right advice;
 * any other status — above all a website's 404 on `/api/health` — means the address points
 * somewhere that is not Saldo.
 */
export function readHealth(status: number | null, body: unknown): HealthReading {
  if (status === null || status >= 500) return { kind: 'unreachable' };
  if (status < 200 || status >= 300) return { kind: 'not_saldo' };
  const parsed = healthSchema.safeParse(body);
  return parsed.success ? { kind: 'saldo', health: parsed.data } : { kind: 'not_saldo' };
}
