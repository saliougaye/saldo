'use client';

import { useSyncExternalStore } from 'react';
import { minuteOf } from './timeZoneRows';

const MINUTE = 60_000;

function currentMinute(): number {
  return minuteOf(new Date());
}

/** One timer for the next minute, then one for each minute after it, until the reader unmounts. */
function subscribe(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    timer = setTimeout(
      () => {
        onChange();
        schedule();
      },
      MINUTE - (Date.now() % MINUTE),
    );
  };
  schedule();
  return () => clearTimeout(timer);
}

/**
 * The current minute (`minuteOf`), new at each minute while a component reads it. The server and
 * the hydration read `renderedAt`, the minute of the server's render: thus the hydration finds the
 * server's text, and React then renders the browser's minute. A component that mounts after the
 * hydration (a panel opened by a click) reads the browser's minute in its first render.
 */
export function useMinute(renderedAt: number): number {
  return useSyncExternalStore(subscribe, currentMinute, () => renderedAt);
}
