import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../test/harness';
import { createTestSession } from '../../test/session';
import { readUserData } from '../../userData/read';
import { bumpRow, seedOnboarded, stampOf } from '../../write/fixtures';
import { tagHandlers } from './tags';
import { fixtureClock, messageOf, run, valueOf } from './testKit';
import { transactionHandlers } from './transactions';

let harness: TestDatabase;
let userId: string;
const { saveTag, mergeTags, deleteTag } = tagHandlers(fixtureClock);
const { saveTransaction } = transactionHandlers(fixtureClock);

beforeAll(async () => {
  harness = await createTestDatabase();
});
afterEach(async () => {
  await harness.reset();
});
afterAll(async () => {
  await harness.close();
});

async function onboarded() {
  userId = (await createTestSession(harness.db)).userId;
  await seedOnboarded(harness.db, userId);
}

const data = () => readUserData(harness.db, userId);

async function taggedExpense(tagId: string): Promise<string> {
  const saved = valueOf(
    await run(saveTransaction, userId, {
      kind: 'expense',
      amountMinor: 1500,
      accountId: 'acc-main',
      categoryId: 'seed-category-groceries',
      tagIds: [tagId],
    }),
  );
  return saved.id;
}

describe('save_tag', () => {
  it('creates a tag, and answers the same tag for the same name in any case', async () => {
    await onboarded();
    const first = valueOf(await run(saveTag, userId, { name: 'Lavoro' }));
    const again = valueOf(await run(saveTag, userId, { name: 'lavoro' }));
    expect(first.created).toBe(true);
    expect(again).toEqual({ ...first, created: false });
  });

  it('renames, refusing a name another tag has', async () => {
    await onboarded();
    const work = valueOf(await run(saveTag, userId, { name: 'Lavoro' }));
    valueOf(await run(saveTag, userId, { name: 'Ufficio' }));
    expect(
      messageOf(
        await run(saveTag, userId, { id: work.id, updatedAt: work.updatedAt, name: 'ufficio' }),
      ),
    ).toMatch(/already has this name/);
    const renamed = valueOf(
      await run(saveTag, userId, { id: work.id, updatedAt: work.updatedAt, name: 'Clienti' }),
    );
    expect(renamed).toMatchObject({ id: work.id, created: false });
    expect((await data()).tags.find((row) => row.id === work.id)?.name).toBe('Clienti');
  });
});

describe('merge_tags and delete_tag', () => {
  it('merges the source into the target on every transaction', async () => {
    await onboarded();
    const source = valueOf(await run(saveTag, userId, { name: 'Lavoro' }));
    const target = valueOf(await run(saveTag, userId, { name: 'Ufficio' }));
    const tx = await taggedExpense(source.id);
    expect(
      valueOf(
        await run(mergeTags, userId, {
          sourceId: source.id,
          sourceUpdatedAt: source.updatedAt,
          targetId: target.id,
        }),
      ),
    ).toEqual({ sourceId: source.id, targetId: target.id });
    const after = await data();
    expect(after.tags.map((row) => row.id)).toEqual([target.id]);
    expect(after.transactions.find((row) => row.id === tx)?.tagIds).toEqual([target.id]);
  });

  it('refuses a stale source, and deletes a tag off its transactions', async () => {
    await onboarded();
    const source = valueOf(await run(saveTag, userId, { name: 'Lavoro' }));
    const target = valueOf(await run(saveTag, userId, { name: 'Ufficio' }));
    const tx = await taggedExpense(source.id);
    await bumpRow(harness.db, userId, 'tag', source.id, { name: 'Lavori' });
    expect(
      messageOf(
        await run(mergeTags, userId, {
          sourceId: source.id,
          sourceUpdatedAt: source.updatedAt,
          targetId: target.id,
        }),
      ),
    ).toMatch(/changed after you read it/);
    const current = await stampOf(harness.db, userId, 'tag', source.id);
    expect(valueOf(await run(deleteTag, userId, { id: source.id, updatedAt: current }))).toEqual({
      id: source.id,
    });
    expect((await data()).transactions.find((row) => row.id === tx)?.tagIds).toEqual([]);
  });
});
