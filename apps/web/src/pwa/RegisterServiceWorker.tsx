'use client';

import { useEffect } from 'react';

/**
 * Registers `/sw.js` (§17.1.7). Production only: in `next dev` a worker would serve the offline page
 * over a server that is merely restarting, and hide the error overlay behind it. Renders nothing.
 * Registration needs a secure context; on plain http the browser refuses and the app is just a site.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Not installable here (insecure origin, private mode): nothing to tell the person.
    });
  }, []);
  return null;
}
