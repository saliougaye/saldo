import styles from './ProgressBar.module.css';

interface Props {
  /** 0–1; anything outside is clamped, because a bar that overflows its track reads as a bug. */
  ratio: number;
  /** Where the period is: the tick the phone draws over the bar (§5.2). `null` draws none. */
  pace?: number | null;
  /** `done` is a goal at or above its target (§5.13): the fill turns `positive`, as on the phone. */
  tone?: 'normal' | 'over' | 'done';
  thick?: boolean;
}

export function ProgressBar({ ratio, pace = null, tone = 'normal', thick = false }: Props) {
  const clamped = Math.min(1, Math.max(0, ratio));
  return (
    <div className={`${styles.track} ${thick ? styles.thick : ''}`}>
      <div
        className={`${styles.fill} ${tone === 'normal' ? '' : styles[tone]}`}
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
