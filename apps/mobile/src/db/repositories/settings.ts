import { SETTINGS_ID, type Settings, settingsSchema } from '@saldo/core';
import { eq } from 'drizzle-orm';
import { settings } from '../schema';
import { insertStamp, type RepositoryContext, toEntity, updateStamp } from './support';

/** The settings singleton (§4): exactly one row, with the fixed id `settings`. */
export interface SettingsRepository {
  get(): Settings | null;
  /** Creates the row during onboarding; fails loudly if it already exists. */
  create(input: Omit<Settings, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Settings;
  update(patch: Partial<Omit<Settings, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>): Settings;
}

export function createSettingsRepository(context: RepositoryContext): SettingsRepository {
  const { db } = context;
  const read = (): Settings | null => {
    const [row] = db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).all();
    return row === undefined ? null : toEntity(row);
  };
  return {
    get: read,
    create(input) {
      const entity = settingsSchema.parse({
        ...input,
        id: SETTINGS_ID,
        ...insertStamp(context),
      });
      db.insert(settings)
        .values({ ...entity, syncState: 1 })
        .run();
      return entity;
    },
    update(patch) {
      const current = read();
      if (current === null) throw new Error('Settings row does not exist yet');
      const entity = settingsSchema.parse({ ...current, ...patch, ...updateStamp(context) });
      db.update(settings)
        .set({ ...entity, syncState: 1 })
        .where(eq(settings.id, SETTINGS_ID))
        .run();
      return entity;
    },
  };
}
