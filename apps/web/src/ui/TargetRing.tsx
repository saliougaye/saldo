import { ringGeometry } from '@saldo/ui';
import styles from './TargetRing.module.css';

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
        transform={`rotate(-90 ${ring.centre} ${ring.centre})`}
        className={tone === 'over' ? styles.over : styles.fill}
      />
    </svg>
  );
}
