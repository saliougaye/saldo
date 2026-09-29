import { type IconName, ringGeometry } from '@saldo/ui';
import { Icon } from './Icon';
import { paletteIndex } from './IconBox';
import styles from './TargetRing.module.css';

/** The pace tick across the stroke, as thin as the phone draws it. */
const TICK_WIDTH = 1.25;

interface Props {
  size: number;
  ratio: number;
  pace?: number | null;
  /** `done` is a goal at or above its target (§5.13): the stroke turns `positive`, as on the phone. */
  tone?: 'normal' | 'over' | 'done';
  /** Drawn inside the ring, in its category's colour: the phone's `TargetRing` with an icon. */
  icon?: IconName;
  colorIndex?: number;
}

/** The same geometry the phone draws with `react-native-svg`, in DOM SVG (§17.1.7). */
export function TargetRing({ size, ratio, pace = null, tone = 'normal', icon, colorIndex }: Props) {
  const ring = ringGeometry(size, ratio, pace);
  const svg = (
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
          className={tone === 'normal' ? styles.fill : styles[tone]}
        />
        {ring.tick === null ? null : (
          <line {...ring.tick} strokeWidth={TICK_WIDTH} className={styles.tick} />
        )}
      </g>
    </svg>
  );
  if (icon === undefined) return svg;
  return (
    <span
      className={styles.ring}
      style={{
        width: size,
        height: size,
        color: colorIndex === undefined ? undefined : `var(--category-${paletteIndex(colorIndex)})`,
      }}
    >
      {svg}
      <span className={styles.icon}>
        <Icon name={icon} size={size >= 36 ? 16 : 14} />
      </span>
    </span>
  );
}
