import { type LocalDate, newId, type Transaction, transactionSchema } from '@saldo/core';
import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { transactions } from '../schema';
import { insertStamp, isoNow, type RepositoryContext, toEntity, updateStamp } from './support';

type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  id?: string;
};

export interface TransactionsRepository {
  create(input: TransactionInput): Transaction;
  update(id: string, patch: Partial<TransactionInput>): Transaction;
  /** Tombstone. The undo toast of §5.12 calls `restore`. */
  remove(id: string): void;
  restore(id: string): void;
  byId(id: string): Transaction | null;
  /** Live rows in a date range, newest first — the only shape screens should load (§7). */
  inRange(start: LocalDate, end: LocalDate): Transaction[];
  list(): Transaction[];
}

export function createTransactionsRepository(context: RepositoryContext): TransactionsRepository {
  const { db } = context;
  const read = (id: string): Transaction | null => {
    const [row] = db.select().from(transactions).where(eq(transactions.id, id)).all();
    return row === undefined ? null : toEntity(row);
  };
  return {
    create(input) {
      const entity = transactionSchema.parse({
        ...input,
        id: input.id ?? newId(),
        ...insertStamp(context),
      });
      db.insert(transactions)
        .values({ ...entity, syncState: 1 })
        .run();
      return entity;
    },
    update(id, patch) {
      const current = read(id);
      if (current === null) throw new Error(`No transaction ${id}`);
      const entity = transactionSchema.parse({ ...current, ...patch, id, ...updateStamp(context) });
      db.update(transactions)
        .set({ ...entity, syncState: 1 })
        .where(eq(transactions.id, id))
        .run();
      return entity;
    },
    remove(id) {
      db.update(transactions)
        .set({ deletedAt: (context.nowIso ?? isoNow)(), ...updateStamp(context) })
        .where(eq(transactions.id, id))
        .run();
    },
    restore(id) {
      db.update(transactions)
        .set({ deletedAt: null, ...updateStamp(context) })
        .where(eq(transactions.id, id))
        .run();
    },
    byId: read,
    inRange(start, end) {
      return db
        .select()
        .from(transactions)
        .where(
          and(
            isNull(transactions.deletedAt),
            gte(transactions.date, start),
            lte(transactions.date, end),
          ),
        )
        .orderBy(desc(transactions.date), desc(transactions.createdAt), desc(transactions.id))
        .all()
        .map(toEntity);
    },
    list() {
      return db
        .select()
        .from(transactions)
        .where(isNull(transactions.deletedAt))
        .orderBy(desc(transactions.date), desc(transactions.createdAt), desc(transactions.id))
        .all()
        .map(toEntity);
    },
  };
}
