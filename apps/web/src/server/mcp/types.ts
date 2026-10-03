import type { AnyWriteToolSpec, ToolContext, WriteToolSpec } from '@saldo/core';
import type { McpPrincipal } from './token';

export type { McpPrincipal };

/**
 * §17.4.2. A write tool maps its input onto the server's write functions (`src/server/write/*`) and
 * answers a value or a readable refusal — never a throw for a rule, a conflict or an unknown id.
 */
export type ToolResult<O> = { ok: true; value: O } | { ok: false; message: string };

export type WriteToolHandler<I, O> = {
  spec: WriteToolSpec<I, O>;
  handle(principal: McpPrincipal, input: I, ctx: ToolContext): Promise<ToolResult<O>>;
};

/**
 * The type-erased handler the server registers. `handle` is a method, so a `WriteToolHandler<I, O>`
 * is assignable without a cast (method parameters are checked bivariantly); the SDK has already
 * validated `input` against `spec.input` when `handle` runs.
 */
export interface AnyWriteToolHandler {
  readonly spec: AnyWriteToolSpec;
  handle(principal: McpPrincipal, input: unknown, ctx: ToolContext): Promise<ToolResult<unknown>>;
}

/** The one place a typed handler is erased. 0.4b writes `defineWriteToolHandler({ spec, handle })`. */
export function defineWriteToolHandler<I, O>(handler: WriteToolHandler<I, O>): AnyWriteToolHandler {
  return handler;
}
