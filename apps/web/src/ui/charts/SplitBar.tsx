import { splitShares } from '@saldo/ui';
import styles from './SplitBar.module.css';

export interface SplitSegment {
  key: string;
  amount: number;
  /** A CSS colour from the tokens: `var(--category-3)`, `var(--color-bar-grey)`. */
  colour: string;
}

/**
 * The phone's `SplitBar` (§5.4): segments sized by their share, in the order given, and the empty
 * track when there is nothing to split. Ripartizione and Quota impegnata are the same bar with
 * different segments. `splitShares` answers in 0–1, which is what `flex-grow` wants.
 */
export function SplitBar({ segments }: { segments: readonly SplitSegment[] }) {
  const shares = splitShares(segments);
  return (
    <div className={styles.bar} aria-hidden="true">
      {shares === null
        ? null
        : shares.map(({ segment, share }) => (
            <span
              key={segment.key}
              className={styles.segment}
              style={{ flexGrow: share, background: segment.colour }}
            />
          ))}
    </div>
  );
}
