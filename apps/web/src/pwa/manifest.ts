import { palettes } from '@saldo/ui';
import type { MetadataRoute } from 'next';

/** The name the home screen shows under the icon; longer ones are cut by the launcher anyway. */
const SHORT_NAME_LENGTH = 12;

/**
 * The colour of the splash screen and the title bar of an installed app. The icon is drawn on
 * `surface`, so the splash and the icon are one flat colour rather than a square on a different one.
 */
const INSTALL_COLOR = palettes.light.surface;

/** §17.1.7: installable, online-only. `name` is the instance's, so two servers on one phone are told apart. */
export function buildManifest(name: string): MetadataRoute.Manifest {
  return {
    name,
    short_name: name.length > SHORT_NAME_LENGTH ? name.slice(0, SHORT_NAME_LENGTH).trimEnd() : name,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: INSTALL_COLOR,
    theme_color: INSTALL_COLOR,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
