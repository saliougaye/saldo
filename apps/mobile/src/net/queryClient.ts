import { QueryClient } from '@tanstack/react-query';

/**
 * D22: TanStack Query is the **network** layer only — auth and sync. Local reads stay on
 * `useLiveQuery`, which is already reactive through the SQLite change listener. Nothing here has a
 * component-mount lifecycle: the scheduler drives sync imperatively, so retries and backoff are
 * configured for one-shot calls rather than for cached queries.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  });
}
