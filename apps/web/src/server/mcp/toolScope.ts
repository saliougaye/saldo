/**
 * Local stand-in for `@saldo/core`'s `ToolScope` (plan 0.4a-1, `assistant/types.ts`), which is not on
 * this branch yet.
 *
 * TODO(0.4a-1 merge): import from @saldo/core — delete this file and import `ToolScope` from
 * `@saldo/core` in `token.ts`, `consent.ts` and `connectors.ts`.
 */
export type ToolScope = 'read' | 'write';
