'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
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

/** A group of the menu: its title, then its links (W10). */
export function SubnavGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      <p className={styles.groupTitle}>{title}</p>
      {children}
    </div>
  );
}

/** The line above «Sign out», the last item of the menu. */
export function SubnavSeparator() {
  return <hr className={styles.separator} />;
}
