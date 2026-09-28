import styles from './ProgressBar.module.css';

interface Props {
  /** 0–1; anything outside is clamped, because a bar that overflows its track reads as a bug. */
  ratio: number;
  /** Where the period is: the tick the phone draws over the bar (§5.2). `null` draws none. */
  pace?: number | null;
  tone?: 'normal' | 'over';
  thick?: boolean;
}

export function ProgressBar({ ratio, pace = null, tone = 'normal', thick = false }: Props) {
  const clamped = Math.min(1, Math.max(0, ratio));
  return (
    <div className={`${styles.track} ${thick ? styles.thick : ''}`}>
      <div
        className={`${styles.fill} ${tone === 'over' ? styles.over : ''}`}
        style={{ inlineSize: `${clamped * 100}%` }}
      />
      {pace === null ? null : (
        <span
          className={styles.tick}
          style={{ insetInlineStart: `${Math.min(1, Math.max(0, pace)) * 100}%` }}
        />
      )}
    </div>
  );
}
