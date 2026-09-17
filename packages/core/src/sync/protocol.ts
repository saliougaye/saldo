import { z } from 'zod';
import { type EntityName, entitySchemas } from '../entities';
import { isHlc } from './hlc';

/**
 * Bumped whenever a synced schema changes in a way an older peer cannot represent — a widened
 * enum, a new required field. §8.1: rather than letting an older device silently drop rows it
 * cannot parse, both sides compare this number first and refuse to sync on a mismatch, so the user
 * is told to update instead of losing data.
 */
export const SYNC_SCHEMA_VERSION = 1;

/** §8.3: the client batches at this size. */
export const MAX_CHANGES_PER_PUSH = 500;
export const MAX_CHANGES_PER_PULL = 500;

export const entityNameSchema = z.enum(Object.keys(entitySchemas) as [EntityName, ...EntityName[]]);

const hlcSchema = z.string().refine(isHlc, 'must be an HLC timestamp');

/**
 * The envelope without the deep body check. The push *request* is parsed with this, not with
 * `syncChangeSchema`: §8.3 answers `invalid` for the one bad row and applies the rest, so a single
 * unparsable body must not reject the whole batch with a 400.
 */
export const syncChangeEnvelopeSchema = z.object({
  entity: entityNameSchema,
  id: z.string().min(1),
  updatedAt: hlcSchema,
  deletedAt: z.iso.datetime().nullable(),
  data: z.unknown(),
});

export type SyncChangeEnvelope = z.infer<typeof syncChangeEnvelopeSchema>;

/**
 * One row in flight, fully checked. `data` is the whole entity, and the three envelope fields must
 * repeat what is inside it: the server indexes on the envelope and stores `data` opaquely, so a
 * disagreement would make the two views of the same row permanently inconsistent.
 */
export const syncChangeSchema = syncChangeEnvelopeSchema.superRefine((change, ctx) => {
  const parsed = entitySchemas[change.entity].safeParse(change.data);
  if (!parsed.success) {
    ctx.addIssue({
      code: 'custom',
      path: ['data'],
      message: parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; '),
    });
    return;
  }
  const entity = parsed.data;
  if (entity.id !== change.id) {
    ctx.addIssue({ code: 'custom', path: ['id'], message: 'does not match data.id' });
  }
  if (entity.updatedAt !== change.updatedAt) {
    ctx.addIssue({ code: 'custom', path: ['updatedAt'], message: 'does not match data.updatedAt' });
  }
  if ((entity.deletedAt ?? null) !== change.deletedAt) {
    ctx.addIssue({ code: 'custom', path: ['deletedAt'], message: 'does not match data.deletedAt' });
  }
});

export type SyncChange = z.infer<typeof syncChangeSchema>;

/**
 * §8.6. Which generation of an account's data a device holds. It starts at 0 and goes up by one
 * every time the account's data is deleted, so a device still holding the previous generation can
 * be told so instead of pushing deleted rows back.
 */
export const dataEpochSchema = z.number().int().nonnegative();

/** `GET /api/data` and `DELETE /api/data`. */
export const dataEpochResponseSchema = z.object({ epoch: dataEpochSchema });

export type DataEpochResponse = z.infer<typeof dataEpochResponseSchema>;

/** The 409 a push or a pull answers when the device holds an earlier generation (§8.6). */
export const DATA_RESET_CODE = 'data_reset';

export const pushRequestSchema = z.object({
  schemaVersion: z.number().int().positive(),
  deviceId: z.string().min(1).max(128),
  /**
   * The generation these changes were written against. Optional only so a request that predates
   * §8.6 still parses; the app always sends it.
   */
  epoch: dataEpochSchema.optional(),
  changes: z.array(syncChangeEnvelopeSchema).max(MAX_CHANGES_PER_PUSH),
});

export type PushRequest = z.infer<typeof pushRequestSchema>;

export const pushResultStatusSchema = z.enum(['applied', 'stale', 'invalid']);

export const pushResponseSchema = z.object({
  schemaVersion: z.number().int().positive(),
  serverTime: z.iso.datetime(),
  results: z.array(
    z.object({
      entity: entityNameSchema,
      id: z.string().min(1),
      status: pushResultStatusSchema,
      error: z.string().optional(),
    }),
  ),
});

export type PushResponse = z.infer<typeof pushResponseSchema>;
export type PushResult = PushResponse['results'][number];

/**
 * A pulled row. `data` stays `unknown` here: the client validates it with `entitySchemas` as it
 * applies, so one unparsable row becomes one error instead of failing the whole page.
 */
export const pullChangeSchema = z.object({
  entity: entityNameSchema,
  id: z.string().min(1),
  updatedAt: hlcSchema,
  deletedAt: z.iso.datetime().nullable(),
  data: z.unknown(),
  seq: z.number().int().nonnegative(),
});

export type PullChange = z.infer<typeof pullChangeSchema>;

export const pullResponseSchema = z.object({
  schemaVersion: z.number().int().positive(),
  changes: z.array(pullChangeSchema),
  nextSince: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

export type PullResponse = z.infer<typeof pullResponseSchema>;

export type SchemaVersionVerdict = 'ok' | 'peer-too-old' | 'peer-too-new';

/**
 * Compares a peer's schema version with ours. Split out so both the app and the server phrase the
 * same verdict in their own words ("update the app" vs "update the server").
 */
export function compareSchemaVersion(peer: number): SchemaVersionVerdict {
  if (peer === SYNC_SCHEMA_VERSION) return 'ok';
  return peer < SYNC_SCHEMA_VERSION ? 'peer-too-old' : 'peer-too-new';
}
