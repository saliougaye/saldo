'use client';

import type { IconName } from '@saldo/ui';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { isCurrent } from '../features/shell/nav';
import { AppLink as Link } from './AppLink';
import { Icon } from './Icon';
import { PANEL_SLOT } from './panelSlot';
import styles from './SubnavLayout.module.css';

/**
 * W10: the frame of Profile, which Admin shares — the head, a menu of 220px on the left, the
 * section on the right. Below 760px the page at `indexPath` is the menu alone, as a list of groups
 * (the phone's Profile), and a section shows alone with «‹ Profile» back to that list. A client
 * component only to read the path. `PasskeyList` portals its panel into the slot.
 */
export function SubnavLayout({
  navLabel,
  head,
  nav,
  indexPath,
  back,
  children,
}: {
  navLabel: string;
  head: ReactNode;
  nav: ReactNode;
  /** The page that is the menu below 760px: `/profile`. */
  indexPath: string;
  back: { text: string; label: string };
  children: ReactNode;
}) {
  const index = usePathname() === indexPath;
  return (
    <div className={styles.page} data-index={index ? '' : undefined}>
      <div className={styles.head}>{head}</div>
      <Link className={styles.back} href={indexPath} aria-label={back.label}>
        <Icon name="chevL" size={16} />
        {back.text}
      </Link>
      <div className={styles.layout}>
        <nav className={styles.subnav} aria-label={navLabel}>
          {nav}
        </nav>
        <div className={styles.section}>{children}</div>
        {/* `PasskeyList` opens its panel here with `createPortal`. */}
        <div id={PANEL_SLOT} className={styles.slot} />
      </div>
    </div>
  );
}

/** A group of the menu: its title, then its links (W10). Below 760px the links are in a box. */
export function SubnavGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      <p className={styles.groupTitle}>{title}</p>
      <div className={styles.items}>{children}</div>
    </div>
  );
}

/**
 * One item of the menu. On a wide screen: the icon, the label and the count. Below 760px, on the
 * list of groups (spec §06): the label, a hint of what is inside («2 passkey», «Italiano · Sistema
 * · EUR») and a chevron. The hint is drawn for the eye only: the link is named by its label and its
 * count, and the section says the rest.
 */
export function SubnavLink({
  href,
  icon,
  label,
  count,
  hint,
  alsoCurrentAt,
}: {
  href: string;
  icon: IconName;
  label: string;
  /** How many there are («Categorie 18»): at the end on a wide screen, as the hint on the list. */
  count?: number;
  /** Only on the list below 760px, where an item has no count. */
  hint?: string;
  /** A second path where this link is the current one: «Profile» on the bare `/profile`. */
  alsoCurrentAt?: string;
}) {
  const path = usePathname();
  const current = isCurrent(href, path) || (alsoCurrentAt !== undefined && path === alsoCurrentAt);
  return (
    <Link className={styles.link} href={href} aria-current={current ? 'page' : undefined}>
      <Icon name={icon} size={18} className={styles.linkIcon} />
      <span className={styles.linkLabel}>{label}</span>
      {count === undefined ? null : <span className={styles.count}>{count}</span>}
      {hint === undefined || hint === '' ? null : (
        <span className={styles.hint} aria-hidden="true">
          {hint}
        </span>
      )}
      <Icon name="chevR" size={16} className={styles.chevron} />
    </Link>
  );
}

/** The line above «Sign out», the last item of the menu. */
export function SubnavSeparator() {
  return <hr className={styles.separator} />;
}

/** «Sign out»: under the line on a wide screen, in a box of its own on the list below 760px. */
export function SubnavFoot({ children }: { children: ReactNode }) {
  return <div className={styles.foot}>{children}</div>;
}
