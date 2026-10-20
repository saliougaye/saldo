import { tokensCss } from '@saldo/ui';

/**
 * Spec 0.8a §03: the `@saldo/ui` tokens as custom properties, with the Geist font families. The
 * landing page and the docs pages (spec 0.8b §06) put this into one `<style>` in `<head>`.
 */
export const siteTokensCss = `${tokensCss()}
:root {
  --font-family: "Geist Sans", "Inter Tight", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, Menlo, monospace;
}`;
