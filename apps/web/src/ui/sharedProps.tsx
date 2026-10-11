'use client';

import { createContext, type ReactNode, useContext } from 'react';

/**
 * Props that every row's form of a page has in common — the messages, the option lists — given once
 * at the page's root and read by each form. A page that renders one form for each row
 * (`PanelSwitch`) would otherwise send them once for each row. The provider renders no element, so
 * it can wrap a `PanelSwitch` that must be the root of a section.
 */
export function sharedProps<T>(component: string) {
  const Context = createContext<T | null>(null);

  function Provider({ value, children }: { value: T; children: ReactNode }) {
    return <Context value={value}>{children}</Context>;
  }

  function useShared(): T {
    const value = useContext(Context);
    if (value === null) throw new Error(`${component} needs its shared props provider`);
    return value;
  }

  return { Provider, useShared };
}
