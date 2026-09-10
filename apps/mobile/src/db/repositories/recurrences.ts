import { newId, type Recurrence, recurrenceSchema } from '@saldo/core';
import { asc, eq, isNull } from 'drizzle-orm';
import { recurrences } from '../schema';
import { insertStamp, isoNow, type RepositoryContext, toEntity, updateStamp } from './support';

type RecurrenceInput = Omit<Recurrence, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  id?: string;
};

export interface RecurrencesRepository {
  create(input: RecurrenceInput): Recurrence;
  update(id: string, patch: Partial<RecurrenceInput>): Recurrence;
  remove(id: string): void;
  byId(id: string): Recurrence | null;
  list(): Recurrence[];
}

export function createRecurrencesRepository(context: RepositoryContext): RecurrencesRepository {
  const { db } = context;
  const read = (id: string): Recurrence | null => {
    const [row] = db.select().from(recurrences).where(eq(recurrences.id, id)).all();
    return row === undefined ? null : toEntity(row);
  };
  return {
    create(input) {
      const entity = recurrenceSchema.parse({
        ...input,
        id: input.id ?? newId(),
        ...insertStamp(context),
      });
      db.insert(recurrences)
        .values({ ...entity, syncState: 1 })
        .run();
      return entity;
    },
    update(id, patch) {
      const current = read(id);
      if (current === null) throw new Error(`No recurrence ${id}`);
      const entity = recurrenceSchema.parse({ ...current, ...patch, id, ...updateStamp(context) });
      db.update(recurrences)
        .set({ ...entity, syncState: 1 })
        .where(eq(recurrences.id, id))
        .run();
      return entity;
    },
    remove(id) {
      db.update(recurrences)
        .set({ deletedAt: (context.nowIso ?? isoNow)(), ...updateStamp(context) })
        .where(eq(recurrences.id, id))
        .run();
    },
    byId: read,
    list() {
      return db
        .select()
        .from(recurrences)
        .where(isNull(recurrences.deletedAt))
        .orderBy(asc(recurrences.startDate))
        .all()
        .map(toEntity);
    },
  };
}
