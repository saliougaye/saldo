'use client';

import { Menu } from '@base-ui/react';
import Link from 'next/link';
import chip from './Chip.module.css';
import styles from './FilterMenu.module.css';
import { Icon } from './Icon';

export interface FilterOption {
  key: string;
  label: string;
  href: string;
  selected: boolean;
}

interface Props {
  /** The chip's text: the filter's name, or the choice that is on. */
  label: string;
  active: boolean;
  options: FilterOption[];
}

/**
 * A filter chip that opens the list of what it can be set to (§17.1.7). Every option is a link, as
 * a chip is: the filter lives in the URL, so choosing is a navigation and the menu only closes.
 */
export function FilterMenu({ label, active, options }: Props) {
  return (
    <Menu.Root>
      <Menu.Trigger className={`${chip.chip} ${active ? chip.active : ''}`}>
        {label}
        <Icon name="chevD" size={14} className={chip.chevron} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8} align="start">
          <Menu.Popup className={styles.popup}>
            {options.map((option) => (
              <Menu.LinkItem
                key={option.key}
                className={styles.item}
                closeOnClick
                render={
                  <Link href={option.href} aria-current={option.selected ? 'true' : undefined} />
                }
              >
                <span className={styles.label}>{option.label}</span>
                {option.selected ? <Icon name="check" size={14} /> : null}
              </Menu.LinkItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
