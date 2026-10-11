import type { ReactNode } from 'react';
import { AppLink as Link } from './AppLink';
import { PanelLink } from './PanelNav';
import styles from './SummaryRow.module.css';

interface Props {
  title: string;
  /** Under the title, faint: the days a cycle covers, the hour in a zone. */
  subtitle?: string;
  /** The current value, muted, on the trailing side. */
  value?: ReactNode;
  /** A leading tile, for the passkeys' key. */
  leading?: ReactNode;
  /** A control on the far end, after the value. */
  trailing?: ReactNode;
  /** The whole row opens its editor: the same page with the panel's parameter. */
  href?: string;
  /** Its editor is the one open in the panel. */
  selected?: boolean;
  /**
   * The row of a page whose panel lives in client state (`PanelSwitch`): its whole panel key. A
   * click opens it in the same frame. `selected` is not read then.
   */
  selectId?: string;
  /**
   * The row is a file to save (Profilo → Dati): a plain `<a download>`, which the browser answers
   * by itself — `Link` would try to navigate to a route handler as if it were a page.
   */
  download?: boolean;
}

/** Profilo's row (§17.1.7): the setting and what it is now — the editor opens in the panel. */
export function SummaryRow({
  title,
  subtitle,
  value,
  leading,
  trailing,
  href,
  selected = false,
  selectId,
  download = false,
}: Props) {
  const body = (
    <>
      {leading}
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {subtitle === undefined ? null : <span className={styles.subtitle}>{subtitle}</span>}
      </span>
      {value === undefined ? null : <span className={styles.value}>{value}</span>}
      {trailing}
    </>
  );
  if (href === undefined) return <div className={styles.row}>{body}</div>;
  if (download) {
    return (
      <a className={styles.row} href={href} download>
        {body}
      </a>
    );
  }
  if (selectId !== undefined) {
    return (
      <PanelLink
        className={styles.row}
        selectedClassName={styles.selected}
        selectId={selectId}
        href={href}
      >
        {body}
      </PanelLink>
    );
  }
  return (
    <Link
      className={`${styles.row} ${selected ? styles.selected : ''}`}
      href={href}
      aria-current={selected ? 'true' : undefined}
    >
      {body}
    </Link>
  );
}
