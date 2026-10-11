import type { ReactNode } from 'react';
import { PANEL_SLOT } from './panelSlot';
import styles from './SubnavLayout.module.css';

/**
 * A sub-navigation on the leading side, the section in the middle, and the slot on the trailing
 * side: the shell of Profilo and of the admin panel. A page that is a `PanelSwitch` with `slot`
 * puts its panel in that column itself, with no portal. `PasskeyList` portals its panel into the
 * slot.
 */
export function SubnavLayout({
  navLabel,
  nav,
  children,
}: {
  navLabel: string;
  nav: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.layout}>
      <nav className={styles.subnav} aria-label={navLabel}>
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
