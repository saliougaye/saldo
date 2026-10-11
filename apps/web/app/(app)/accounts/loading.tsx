import { PageSkeleton } from '../../../src/ui/PageSkeleton';

/**
 * A change of tab shows the shell and this at once, while the server renders the page. Each tab has
 * its own file: a `loading.tsx` in `(app)` would also wrap the admin layout, and its `notFound()`
 * would then stream with the status 200, not 404.
 */
export default function Loading() {
  return <PageSkeleton />;
}
