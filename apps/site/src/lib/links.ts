/**
 * The two calls to action (spec 0.8a §10, D50) and the footer links. One module, so the move of the
 * guide to the docs library (0.8b) is one line.
 */
export const REPO_URL = 'https://github.com/saliougaye/saldo';

const onMain = (path: string) => `${REPO_URL}/blob/main/${path}`;

export const GUIDE_URL = onMain('docs/self-hosting.md');
export const SECURITY_URL = onMain('SECURITY.md');
export const CONTRIBUTING_URL = onMain('CONTRIBUTING.md');
export const LICENSE_URL = onMain('LICENSE');
