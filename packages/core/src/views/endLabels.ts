export interface EndLabels {
  start: boolean;
  today: boolean;
  end: boolean;
}

/**
 * Which labels sit under a featured bar (§5.13): the range's start and end, and «oggi» at the
 * tick. An end label steps aside when «oggi» would collide with it; without a pace (a closed
 * range, a reached goal) there is no «oggi» at all.
 */
export function endLabels(pace: number | null): EndLabels {
  if (pace === null) return { start: true, today: false, end: true };
  return { start: pace > 0.18, today: true, end: pace < 0.78 };
}
