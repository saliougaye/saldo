import { PageSkeleton } from '../../../src/ui/PageSkeleton';

/** A change of section keeps the sub-navigation (the layout is above this boundary) and shows this. */
export default function Loading() {
  return <PageSkeleton blocks={3} />;
}
