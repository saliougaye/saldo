'use client';

import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Panel } from './Panel';
import { PANEL_SLOT } from './panelSlot';

/**
 * A `Panel` rendered into the `#profile-panel` slot of a `SubnavLayout`, beside the section. The
 * slot belongs to the layout, so the portal waits for the mount; server pages pass the form as `children`.
 */
export function SlotPanel(props: ComponentProps<typeof Panel>) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(document.getElementById(PANEL_SLOT));
  }, []);
  return slot === null ? null : createPortal(<Panel {...props} />, slot);
}
