import styles from './Steps.module.css';

/** One segment per step, filled up to and including the current one. `at` is 1-based. */
export function Steps({ at, total, label }: { at: number; total: number; label: string }) {
  return (
    <>
      <div className={styles.segments} role="presentation">
        {Array.from({ length: total }, (_, index) => (
          <i
            // biome-ignore lint/suspicious/noArrayIndexKey: positional by nature
            key={`segment-${index}`}
            className={`${styles.segment} ${index < at ? styles.on : ''}`}
          />
        ))}
      </div>
      <div className={styles.label}>{label}</div>
    </>
  );
}

export const stepsBackClass = styles.back;
