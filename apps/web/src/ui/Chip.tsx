import Link from 'next/link';
import styles from './Chip.module.css';

interface Props {
  label: string;
  href: string;
  active?: boolean;
}

/** A filter chip of §5.12. A link, not a button: the filters live in the URL (decision 4). */
export function Chip({ label, href, active = false }: Props) {
  return (
    <Link className={`${styles.chip} ${active ? styles.active : ''}`} href={href}>
      {label}
    </Link>
  );
}
