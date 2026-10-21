'use client';

import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react';
import styles from './TrendScrub.module.css';

/** The coordinate space of the lines. The SVG stretches it to the width it gets. */
const VIEW_WIDTH = 600;
/** H5: the chart is 170px high. */
const HEIGHT = 170;
/** The top of the highest value stays below the top edge, so the dot and its ring stay inside. */
const HEADROOM = 0.92;
/** The five dates under the chart: the first day, the last day and three between. */
const AXIS_TICKS = 5;

interface Props {
  /** Cumulative counted spend per elapsed day (§5.6). */
  current: readonly number[];
  /** The usual spend per day of the whole period. */
  usual: readonly number[];
  /** How many days the period has. The x axis covers all of them. */
  span: number;
  /** One label per day of the period, «12 Sep». */
  dates: readonly string[];
  /** One formatted amount per elapsed day, for the tooltip. */
  currentAmounts: readonly string[];
  /** One formatted amount per day of the period, for the tooltip after today. */
  usualAmounts: readonly string[];
  strings: {
    /** Names the slider for a screen reader. */
    label: string;
    thisPeriod: string;
    usual: string;
    /** «spent by {date}», one per day. */
    spentBy: readonly string[];
    /** «usual by {date}», one per day. */
    usualBy: readonly string[];
    hint: string;
  };
}

function points(
  values: readonly number[],
  x: (index: number) => number,
  y: (value: number) => number,
): string {
  return values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
}

/**
 * H5: this period as a solid line, the usual as a dashed line, three grid lines and five dates.
 * Move the pointer over it, or focus it and use ← →, Home and End: a vertical line, a dot and a
 * tooltip show the day. Up to today the tooltip shows what you spent by that day; after today, what
 * you usually spend by that day, and the dot is faint.
 */
export function TrendScrub({
  current,
  usual,
  span,
  dates,
  currentAmounts,
  usualAmounts,
  strings,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [day, setDay] = useState<number | null>(null);
  const days = Math.max(span, 1);
  const max = Math.max(1, ...current, ...usual);
  const x = (index: number) => (days === 1 ? 0 : (index / (days - 1)) * VIEW_WIDTH);
  const y = (value: number) => HEIGHT - (value / max) * HEIGHT * HEADROOM;
  const last = Math.max(current.length - 1, 0);
  const clamp = (index: number) => Math.min(days - 1, Math.max(0, index));

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = box.current?.getBoundingClientRect();
    if (rect === undefined || rect.width === 0) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    setDay(clamp(Math.round(ratio * (days - 1))));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = day ?? last;
    let next: number | null = null;
    if (event.key === 'ArrowLeft') next = from - 1;
    if (event.key === 'ArrowRight') next = from + 1;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = days - 1;
    if (next === null) return;
    event.preventDefault();
    setDay(clamp(next));
  };

  const shown = day ?? last;
  const past = shown < current.length;
  const value = past ? (current[shown] ?? 0) : (usual[shown] ?? 0);
  const amount = past ? (currentAmounts[shown] ?? '') : (usualAmounts[shown] ?? '');
  const caption = past ? (strings.spentBy[shown] ?? '') : (strings.usualBy[shown] ?? '');
  const left = (x(shown) / VIEW_WIDTH) * 100;
  const top = (y(value) / HEIGHT) * 100;
  const ticks = Array.from({ length: AXIS_TICKS }, (_, index) =>
    Math.round((index * (days - 1)) / (AXIS_TICKS - 1)),
  );

  return (
    <div className={styles.trend}>
      <div className={styles.legend} aria-hidden="true">
        <span>
          <i className={styles.keyCurrent} />
          {strings.thisPeriod}
        </span>
        <span>
          <i className={styles.keyUsual} />
          {strings.usual}
        </span>
      </div>
      <div
        ref={box}
        className={`${styles.scrub} ${day === null ? '' : styles.on}`}
        role="slider"
        tabIndex={0}
        aria-label={strings.label}
        aria-describedby="trend-hint"
        aria-valuemin={1}
        aria-valuemax={days}
        aria-valuenow={shown + 1}
        aria-valuetext={`${amount}, ${caption}`}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setDay(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setDay(null)}
      >
        <svg
          className={styles.svg}
          viewBox={`0 0 ${VIEW_WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {[0.25, 0.5, 0.75].map((share) => (
            <line
              key={share}
              className={styles.grid}
              x1={0}
              x2={VIEW_WIDTH}
              y1={HEIGHT * share}
              y2={HEIGHT * share}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <line
            className={styles.base}
            x1={0}
            x2={VIEW_WIDTH}
            y1={HEIGHT}
            y2={HEIGHT}
            vectorEffect="non-scaling-stroke"
          />
          {usual.length < 2 ? null : (
            <polyline
              className={styles.usual}
              points={points(usual, x, y)}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {current.length < 2 ? null : (
            <polyline
              className={styles.current}
              points={points(current, x, y)}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <span className={styles.line} style={{ insetInlineStart: `${left}%` }} aria-hidden="true" />
        <span
          className={`${styles.dot} ${past ? '' : styles.dotFaint}`}
          style={{ insetInlineStart: `${left}%`, insetBlockStart: `${top}%` }}
          aria-hidden="true"
        />
        <span
          className={styles.tip}
          style={{
            insetInlineStart: `${left}%`,
            transform: `translateX(${left < 12 ? '0' : left > 88 ? '-100%' : '-50%'})`,
          }}
          aria-hidden="true"
        >
          <b>{amount}</b>
          <small>{caption}</small>
        </span>
      </div>
      <div className={styles.axis} aria-hidden="true">
        {ticks.map((index) => (
          <span key={index}>{dates[index] ?? ''}</span>
        ))}
      </div>
      <p id="trend-hint" className={styles.hint}>
        {strings.hint}
      </p>
    </div>
  );
}
