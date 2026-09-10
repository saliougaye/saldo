import { type Account, accountSchema, newId } from '@saldo/core';
import { asc, eq, isNull } from 'drizzle-orm';
import { accounts } from '../schema';
import { insertStamp, type RepositoryContext, toEntity, updateStamp } from './support';

type AccountInput = Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  id?: string;
};

export interface AccountsRepository {
  create(input: AccountInput): Account;
  update(id: string, patch: Partial<AccountInput>): Account;
  /** Tombstone, so other devices converge on the deletion (§7). */
  remove(id: string): void;
  byId(id: string): Account | null;
  /** Live rows in display order; tombstones are never returned. */
  list(): Account[];
}

export function createAccountsRepository(context: RepositoryContext): AccountsRepository {
  const { db } = context;
  const read = (id: string): Account | null => {
    const [row] = db.select().from(accounts).where(eq(accounts.id, id)).all();
    return row === undefined ? null : toEntity(row);
  };
  return {
    create(input) {
      const entity = accountSchema.parse({
        ...input,
        id: input.id ?? newId(),
        ...insertStamp(context),
      });
      db.insert(accounts)
        .values({ ...entity, syncState: 1 })
        .run();
      return entity;
    },
    update(id, patch) {
      const current = read(id);
      if (current === null) throw new Error(`No account ${id}`);
      const entity = accountSchema.parse({ ...current, ...patch, id, ...updateStamp(context) });
      db.update(accounts)
        .set({ ...entity, syncState: 1 })
        .where(eq(accounts.id, id))
        .run();
      return entity;
    },
    remove(id) {
      db.update(accounts)
        .set({
          deletedAt: (context.nowIso ?? (() => new Date().toISOString()))(),
          ...updateStamp(context),
        })
        .where(eq(accounts.id, id))
        .run();
    },
    byId: read,
    list() {
      return db
        .select()
        .from(accounts)
        .where(isNull(accounts.deletedAt))
        .orderBy(asc(accounts.sortOrder), asc(accounts.name))
        .all()
        .map(toEntity);
    },
  };
}
