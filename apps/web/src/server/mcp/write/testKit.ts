import type { ToolContext } from '@saldo/core';
import { FIXTURE_NOW } from '../../write/fixtures';
import type { McpPrincipal, ToolResult, WriteToolHandler } from '../types';
import type { Clock } from './shared';

/** «Today» at FIXTURE_NOW (2026-09-29T10:00Z) in Europe/Rome, the fixture user's zone. */
export const FIXTURE_CTX: ToolContext = { today: '2026-09-29', timeZone: 'Europe/Rome' };

export const fixtureClock: Clock = () => FIXTURE_NOW;

export function writer(userId: string): McpPrincipal {
  return { userId, clientId: 'client-test', scopes: ['read', 'write'] };
}

/** A tool call as the MCP SDK makes it: the arguments parsed by the spec's schema, then handled. */
export function run<I, O>(
  handler: WriteToolHandler<I, O>,
  userId: string,
  raw: unknown,
): Promise<ToolResult<O>> {
  return handler.handle(writer(userId), handler.spec.input.parse(raw), FIXTURE_CTX);
}

export function valueOf<O>(result: ToolResult<O>): O {
  if (!result.ok) throw new Error(`refused: ${result.message}`);
  return result.value;
}

export function messageOf<O>(result: ToolResult<O>): string {
  if (result.ok) throw new Error('expected a refusal');
  return result.message;
}
