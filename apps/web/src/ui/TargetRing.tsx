import { ringGeometry } from '@saldo/ui';
import styles from './TargetRing.module.css';

/** The pace tick across the stroke, as thin as the phone draws it. */
const TICK_WIDTH = 1.25;

interface Props {
  size: number;
  ratio: number;
  pace?: number | null;
  tone?: 'normal' | 'over';
}

/** The same geometry the phone draws with `react-native-svg`, in DOM SVG (§17.1.7). */
export function TargetRing({ size, ratio, pace = null, tone = 'normal' }: Props) {
  const ring = ringGeometry(size, ratio, pace);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {/* `ringGeometry` measures from the positive x axis, tick included: one rotation for all. */}
      <g transform={`rotate(-90 ${ring.centre} ${ring.centre})`}>
        <circle
          cx={ring.centre}
          cy={ring.centre}
          r={ring.radius}
          fill="none"
          strokeWidth={ring.stroke}
          className={styles.track}
        />
        <circle
          cx={ring.centre}
          cy={ring.centre}
          r={ring.radius}
          fill="none"
          strokeWidth={ring.stroke}
          strokeLinecap="round"
          strokeDasharray={`${ring.dash} ${ring.circumference}`}
          className={tone === 'over' ? styles.over : styles.fill}
        />
        {ring.tick === null ? null : (
          <line {...ring.tick} strokeWidth={TICK_WIDTH} className={styles.tick} />
        )}
      </g>
    </svg>
  );
}
