import type { z } from 'zod';
import type { LocalDate } from '../dates';
import type { UserData } from '../userData';

/** The OAuth scope a tool needs (§17.4.1, D40): a `read` token never even lists a write tool. */
export type ToolScope = 'read' | 'write';

/**
 * Where the user's web app shows each kind of row: its base URL and, per kind, a link with `{id}`
 * to replace by the row's id. The server builds it from `PUBLIC_URL`; the routes are the web's.
 */
export type WebAppLinks = {
  url: string;
  transaction: string;
  account: string;
  goal: string;
  budget: string;
  category: string;
  tag: string;
};

/**
 * What a tool is told besides the data: the user's «today», in the user's own zone (§17.1.5, D37).
 * The server derives it with `todayFor`; core never reads a clock. `webApp` is there when the
 * caller knows the web app (the MCP endpoint), so a model can link the user to a row.
 */
export type ToolContext = { today: LocalDate; timeZone: string; webApp?: WebAppLinks };

/** The MCP tool annotations (§17.4.2). Saldo never reaches outside the user's own data. */
export type ToolAnnotations = {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: false;
};

/** Every read tool's annotations: it changes nothing, and asking twice answers the same. */
export const READ_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

/**
 * One tool of the catalogue (§17.4.2): what the model is told about it — name, English description,
 * the Zod schemas of its input and output — and how an MCP client should treat it.
 */
export type ToolSpec<I, O> = {
  name: string;
  title: string;
  description: string;
  scope: ToolScope;
  input: z.ZodType<I>;
  output: z.ZodType<O>;
  annotations: ToolAnnotations;
};

/** A read tool answers from the data alone: a pure function, so the MCP route and 0.5 share it. */
export type ReadTool<I, O> = ToolSpec<I, O> & {
  scope: 'read';
  run(data: UserData, ctx: ToolContext, input: I): O;
};

/** A write tool's description only: the server maps it onto `apps/web/src/server/write/*` (0.4b). */
export type WriteToolSpec<I, O> = ToolSpec<I, O> & { scope: 'write' };

/** A read tool with its types erased, so tools of different shapes share one array. */
export type AnyReadTool = ReadTool<unknown, unknown>;

/** A write spec with its types erased, for `writeTools`. */
export type AnyWriteToolSpec = WriteToolSpec<unknown, unknown>;

/**
 * Erases a read tool's types **safely**: the erased `run` parses its input with the tool's own
 * schema before calling the typed one, so a caller holding `unknown` (the MCP route, 0.5's prompt
 * builder) cannot hand it a shape it was not written for. An invalid input throws a `ZodError`.
 */
export function defineReadTool<I, O>(tool: ReadTool<I, O>): AnyReadTool {
  return {
    ...tool,
    run: (data, ctx, input) => tool.run(data, ctx, tool.input.parse(input)),
  };
}

/** Erases a write spec's types; the handler that parses its input lives on the server (0.4b). */
export function defineWriteToolSpec<I, O>(spec: WriteToolSpec<I, O>): AnyWriteToolSpec {
  return spec;
}
