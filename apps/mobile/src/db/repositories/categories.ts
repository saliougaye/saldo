import { type Category, categorySchema, newId } from '@saldo/core';
import { asc, eq, isNull } from 'drizzle-orm';
import { categories } from '../schema';
import { insertStamp, isoNow, type RepositoryContext, toEntity, updateStamp } from './support';

type CategoryInput = Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  id?: string;
};

export interface CategoriesRepository {
  create(input: CategoryInput): Category;
  update(id: string, patch: Partial<CategoryInput>): Category;
  remove(id: string): void;
  byId(id: string): Category | null;
  list(): Category[];
}

export function createCategoriesRepository(context: RepositoryContext): CategoriesRepository {
  const { db } = context;
  const read = (id: string): Category | null => {
    const [row] = db.select().from(categories).where(eq(categories.id, id)).all();
    return row === undefined ? null : toEntity(row);
  };
  return {
    create(input) {
      const entity = categorySchema.parse({
        ...input,
        id: input.id ?? newId(),
        ...insertStamp(context),
      });
      db.insert(categories)
        .values({ ...entity, syncState: 1 })
        .run();
      return entity;
    },
    update(id, patch) {
      const current = read(id);
      if (current === null) throw new Error(`No category ${id}`);
      const entity = categorySchema.parse({ ...current, ...patch, id, ...updateStamp(context) });
      db.update(categories)
        .set({ ...entity, syncState: 1 })
        .where(eq(categories.id, id))
        .run();
      return entity;
    },
    remove(id) {
      db.update(categories)
        .set({ deletedAt: (context.nowIso ?? isoNow)(), ...updateStamp(context) })
        .where(eq(categories.id, id))
        .run();
    },
    byId: read,
    list() {
      return db
        .select()
        .from(categories)
        .where(isNull(categories.deletedAt))
        .orderBy(asc(categories.sortOrder), asc(categories.name))
        .all()
        .map(toEntity);
    },
  };
}
