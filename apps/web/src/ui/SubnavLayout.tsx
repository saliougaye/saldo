import type { ReactNode } from 'react';
import { AppLink as Link } from './AppLink';
import { Icon } from './Icon';
import { PANEL_SLOT } from './panelSlot';
import styles from './SubnavLayout.module.css';

/**
 * A sub-navigation and the section. On a wide screen the sub-navigation is a column beside the
 * section (D10, 2026-10-11), sticky under the top bar, with «‹ Saldo» and the section's title above
 * the links; on a narrow one it is a row of links above the section. `PasskeyList` portals its panel into the slot with `createPortal`.
 */
export function SubnavLayout({
  navLabel,
  nav,
  title,
  back,
  children,
}: {
  navLabel: string;
  nav: ReactNode;
  /** Who or what the section is about: the person (Profilo), «Admin» and its count. Wide only. */
  title: ReactNode;
  /** «‹ Saldo»: the way back to the app. Wide only (D10). */
  back: { href: string; text: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className={styles.layout}>
      <nav className={styles.subnav} aria-label={navLabel}>
        <Link className={styles.back} href={back.href} aria-label={back.label}>
          <Icon name="chevL" size={16} />
          {back.text}
        </Link>
        <div className={styles.sideTitle}>{title}</div>
        {nav}
      </nav>
      <div className={styles.section}>{children}</div>
      {/* The column beside the section. `PasskeyList` opens its panel here with `createPortal`. */}
      <div id={PANEL_SLOT} className={styles.slot} />
    </div>
  );
}

/** The rule between the links and what follows them; it shows only when the sub-navigation is a column. */
export function SubnavSeparator() {
  return <hr className={styles.separator} />;
}
