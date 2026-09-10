import { type Budget, budgetSchema, newId } from '@saldo/core';
import { asc, eq, isNull } from 'drizzle-orm';
import { budgets } from '../schema';
import { insertStamp, isoNow, type RepositoryContext, toEntity, updateStamp } from './support';

type BudgetInput = Omit<Budget, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & { id?: string };

export interface BudgetsRepository {
  create(input: BudgetInput): Budget;
  update(id: string, patch: Partial<BudgetInput>): Budget;
  remove(id: string): void;
  byId(id: string): Budget | null;
  list(): Budget[];
}

export function createBudgetsRepository(context: RepositoryContext): BudgetsRepository {
  const { db } = context;
  const read = (id: string): Budget | null => {
    const [row] = db.select().from(budgets).where(eq(budgets.id, id)).all();
    return row === undefined ? null : toEntity(row);
  };
  return {
    create(input) {
      const entity = budgetSchema.parse({
        ...input,
        id: input.id ?? newId(),
        ...insertStamp(context),
      });
      db.insert(budgets)
        .values({ ...entity, syncState: 1 })
        .run();
      return entity;
    },
    update(id, patch) {
      const current = read(id);
      if (current === null) throw new Error(`No budget ${id}`);
      const entity = budgetSchema.parse({ ...current, ...patch, id, ...updateStamp(context) });
      db.update(budgets)
        .set({ ...entity, syncState: 1 })
        .where(eq(budgets.id, id))
        .run();
      return entity;
    },
    remove(id) {
      db.update(budgets)
        .set({ deletedAt: (context.nowIso ?? isoNow)(), ...updateStamp(context) })
        .where(eq(budgets.id, id))
        .run();
    },
    byId: read,
    list() {
      return db
        .select()
        .from(budgets)
        .where(isNull(budgets.deletedAt))
        .orderBy(asc(budgets.sortOrder), asc(budgets.name))
        .all()
        .map(toEntity);
    },
  };
}
