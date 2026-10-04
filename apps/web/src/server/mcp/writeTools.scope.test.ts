import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { savedOutput, type ToolScope, writeTools } from '@saldo/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { readUserData } from '../userData/read';
import { seedOnboarded } from '../write/fixtures';
import { buildMcpServer } from './server';
import { FIXTURE_CTX, fixtureClock } from './write/testKit';
import { createWriteToolHandlers, writeToolHandlers } from './writeTools';

let harness: TestDatabase;
let userId: string;

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

/** The server the route builds for one request, wired to an in-memory client. */
async function connect(scopes: ToolScope[]): Promise<Client> {
  const server = buildMcpServer({
    data: await readUserData(harness.db, userId),
    ctx: FIXTURE_CTX,
    principal: { userId, clientId: 'client-test', scopes },
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

/** The first text block: the same JSON on success, the refusal's message on a tool error. */
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

const WRITE_NAMES = writeTools.map((spec) => spec.name);
const expense = {
  kind: 'expense',
  amountMinor: 4820,
  accountId: 'acc-main',
  categoryId: 'seed-category-groceries',
};

describe('the write tools through the MCP server (§17.4.1, §17.4.2)', () => {
  it('has one handler per catalogue write tool, in the same order', () => {
    expect(writeToolHandlers.map((handler) => handler.spec.name)).toEqual(WRITE_NAMES);
  });

  // The route answers a read token's write call with 403 insufficient_scope before any server is
  // built (`app/mcp/route.test.ts`); a server built for that token does not even hold the tool.
  it('a read-only token lists no write tool, and a call writes nothing', async () => {
    await onboarded();
    const client = await connect(['read']);
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    for (const name of WRITE_NAMES) expect(names).not.toContain(name);
    const refused = await client.callTool({ name: 'save_transaction', arguments: expense }).then(
      (result) => 'isError' in result && result.isError === true,
      () => true,
    );
    expect(refused).toBe(true);
    expect((await readUserData(harness.db, userId)).transactions).toEqual([]);
  });

  it('a write token lists all fourteen; a call writes and answers the same JSON twice', async () => {
    await onboarded();
    const client = await connect(['read', 'write']);
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    for (const name of WRITE_NAMES) expect(names).toContain(name);
    const result = await client.callTool({ name: 'save_transaction', arguments: expense });
    const saved = savedOutput.parse(structuredOf(result));
    expect(JSON.parse(textOf(result))).toEqual(saved);
    expect((await readUserData(harness.db, userId)).transactions).toEqual([
      expect.objectContaining({ id: saved.id, amount: 4820 }),
    ]);
  });

  it('a refused write is a tool error with a readable message, not a protocol error', async () => {
    await onboarded();
    const client = await connect(['read', 'write']);
    const result = await client.callTool({
      name: 'save_transaction',
      arguments: { ...expense, categoryId: 'nope' },
    });
    expect('isError' in result && result.isError).toBe(true);
    expect(textOf(result)).toMatch(/list_categories/);
  });

  it('hands the client each write tool with its annotations', async () => {
    await onboarded();
    const client = await connect(['read', 'write']);
    const tools = (await client.listTools()).tools;
    expect(tools.find((tool) => tool.name === 'delete_transaction')?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    });
  });
});
