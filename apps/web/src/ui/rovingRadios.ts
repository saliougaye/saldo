/**
 * Where an arrow key moves the selection of a radio group of `count` options, wrapping at the ends;
 * `null` for any other key. Home and End jump to the first and the last, as the ARIA radio pattern asks.
 */
export function rovingTarget(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}
