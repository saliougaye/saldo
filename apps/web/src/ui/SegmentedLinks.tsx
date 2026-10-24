import { AppLink as Link } from './AppLink';
import styles from './SegmentedLinks.module.css';

interface Props {
  options: readonly { key: string; label: string; href: string; active: boolean }[];
}

/**
 * `Segmented` drawn with links, for a choice that lives in the URL: Statistics' «Expenses ·
 * Income». A link cannot be a radio, so the chosen segment says so with `aria-current`, as a `Chip`
 * does. A server component.
 */
export function SegmentedLinks({ options }: Props) {
  return (
    <div className={styles.group}>
      {options.map((option) => (
        <Link
          key={option.key}
          href={option.href}
          className={styles.option}
          aria-current={option.active ? 'true' : undefined}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
