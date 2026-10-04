import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import {
  formatHlc,
  SYNC_SCHEMA_VERSION,
  type SyncChangeEnvelope,
  savedOutput,
  transactionSchema,
} from '@saldo/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { GET as pull } from '../../../app/api/sync/pull/route';
import { applyPush } from '../sync/push';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession, type TestSession } from '../test/session';
import { readUserData } from '../userData/read';
import { FIXTURE_NOW, seedOnboarded } from '../write/fixtures';
import { buildMcpServer } from './server';
import { FIXTURE_CTX, fixtureClock } from './write/testKit';
import { createWriteToolHandlers } from './writeTools';

let harness: TestDatabase;
let phone: TestSession;

/** A phone whose clock runs 12h ahead of the server: within the 24h §8.2 allows. */
const PHONE_AHEAD_MS = 12 * 3600 * 1000;

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
  phone = await createTestSession(harness.db);
  await seedOnboarded(harness.db, phone.userId);
}

async function connect(): Promise<Client> {
  const server = buildMcpServer({
    data: await readUserData(harness.db, phone.userId),
    ctx: FIXTURE_CTX,
    principal: { userId: phone.userId, clientId: 'client-test', scopes: ['read', 'write'] },
    writeHandlers: createWriteToolHandlers(fixtureClock),
  });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'saldo-test', version: '1.0.0' });
  await client.connect(clientSide);
  return client;
}

type CallResult = Awaited<ReturnType<Client['callTool']>>;

function structuredOf(result: CallResult): unknown {
  return 'structuredContent' in result ? result.structuredContent : undefined;
}

function textOf(result: CallResult): string {
  const content: unknown = 'content' in result ? result.content : undefined;
  if (!Array.isArray(content)) return '';
  const first: unknown = content[0];
  return typeof first === 'object' &&
    first !== null &&
    'text' in first &&
    typeof first.text === 'string'
    ? first.text
    : '';
}

type PulledChange = { entity: string; id: string; updatedAt: string; data: unknown };

async function pullAll(): Promise<PulledChange[]> {
  const response = await pull(
    new Request('http://localhost/api/sync/pull?since=0', {
      headers: { authorization: phone.bearer },
    }),
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as { changes: PulledChange[] };
  return body.changes;
}

async function createExpense(client: Client) {
  const result = await client.callTool({
    name: 'save_transaction',
    arguments: {
      kind: 'expense',
      amountMinor: 4820,
      accountId: 'acc-main',
      categoryId: 'seed-category-groceries',
      description: 'Dal client MCP',
    },
  });
  return savedOutput.parse(structuredOf(result));
}

describe('§17.4.5: an MCP write, as the phone sees it', () => {
  it('reaches the phone on its next pull, with the version the tool answered', async () => {
    await onboarded();
    const created = await createExpense(await connect());

    const change = (await pullAll()).find(
      (each) => each.entity === 'transaction' && each.id === created.id,
    );
    if (change === undefined) throw new Error('the pull did not return the transaction');
    expect(change.updatedAt).toBe(created.updatedAt);
    expect(transactionSchema.parse(change.data)).toMatchObject({
      id: created.id,
      amount: 4820,
      date: '2026-09-29',
      description: 'Dal client MCP',
    });
  });

  it('never overwrites an edit the phone pushed after the client read the row', async () => {
    await onboarded();
    const client = await connect();
    const created = await createExpense(client);

    // The phone edits the transaction and pushes it before the assistant writes again.
    const row = (await readUserData(harness.db, phone.userId)).transactions.find(
      (each) => each.id === created.id,
    );
    if (row === undefined) throw new Error('not stored');
    const phoneStamp = formatHlc({
      wallMs: FIXTURE_NOW.getTime() + PHONE_AHEAD_MS,
      counter: 0,
      deviceId: 'phone-a',
    });
    const phoneEdit: SyncChangeEnvelope = {
      entity: 'transaction',
      id: created.id,
      updatedAt: phoneStamp,
      deletedAt: null,
      data: transactionSchema.parse({ ...row, description: 'Dal telefono', updatedAt: phoneStamp }),
    };
    expect(
      await applyPush(
        harness.db,
        phone.userId,
        { schemaVersion: SYNC_SCHEMA_VERSION, deviceId: 'phone-a', changes: [phoneEdit] },
        FIXTURE_NOW,
      ),
    ).toEqual([{ entity: 'transaction', id: created.id, status: 'applied' }]);

    // The assistant still holds the version it got back from save_transaction.
    const result = await client.callTool({
      name: 'save_transaction',
      arguments: { id: created.id, updatedAt: created.updatedAt, amountMinor: 9900 },
    });
    expect('isError' in result && result.isError).toBe(true);
    expect(textOf(result)).toMatch(/changed after you read it/);
    expect((await readUserData(harness.db, phone.userId)).transactions).toEqual([
      expect.objectContaining({ id: created.id, amount: 4820, description: 'Dal telefono' }),
    ]);
  });
});
