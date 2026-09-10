import { newId, type Tag, tagSchema } from '@saldo/core';
import { asc, eq, isNull } from 'drizzle-orm';
import { tags } from '../schema';
import { insertStamp, isoNow, type RepositoryContext, toEntity, updateStamp } from './support';

type TagInput = Omit<Tag, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & { id?: string };

export interface TagsRepository {
  create(input: TagInput): Tag;
  rename(id: string, name: string): Tag;
  remove(id: string): void;
  byId(id: string): Tag | null;
  list(): Tag[];
  /** §5.10: names are unique case-insensitively among live tags. */
  findByName(name: string): Tag | null;
}

export function createTagsRepository(context: RepositoryContext): TagsRepository {
  const { db } = context;
  const read = (id: string): Tag | null => {
    const [row] = db.select().from(tags).where(eq(tags.id, id)).all();
    return row === undefined ? null : toEntity(row);
  };
  const repository: TagsRepository = {
    create(input) {
      const existing = repository.findByName(input.name);
      if (existing !== null) throw new Error(`Tag "${input.name}" already exists`);
      const entity = tagSchema.parse({
        ...input,
        id: input.id ?? newId(),
        ...insertStamp(context),
      });
      db.insert(tags)
        .values({ ...entity, syncState: 1 })
        .run();
      return entity;
    },
    rename(id, name) {
      const current = read(id);
      if (current === null) throw new Error(`No tag ${id}`);
      const entity = tagSchema.parse({ ...current, name, ...updateStamp(context) });
      db.update(tags)
        .set({ ...entity, syncState: 1 })
        .where(eq(tags.id, id))
        .run();
      return entity;
    },
    remove(id) {
      db.update(tags)
        .set({ deletedAt: (context.nowIso ?? isoNow)(), ...updateStamp(context) })
        .where(eq(tags.id, id))
        .run();
    },
    byId: read,
    list() {
      return db
        .select()
        .from(tags)
        .where(isNull(tags.deletedAt))
        .orderBy(asc(tags.name))
        .all()
        .map(toEntity);
    },
    findByName(name) {
      const wanted = name.trim().toLowerCase();
      return repository.list().find((tag) => tag.name.toLowerCase() === wanted) ?? null;
    },
  };
  return repository;
}
