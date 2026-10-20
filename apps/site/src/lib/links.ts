/**
 * The two calls to action (spec 0.8a §10, D50) and the footer links. Since 0.8b the guide, the
 * security policy and the contribution guide are pages of the docs library (spec 0.8b §08).
 */
export const REPO_URL = 'https://github.com/saliougaye/saldo';

/** A file of the repository on GitHub, on `main`. */
export const blobUrl = (path: string) => `${REPO_URL}/blob/main/${path}`;
/** The GitHub editor for a file on `main`: the «Edit page» link of a docs page. */
export const editUrl = (path: string) => `${REPO_URL}/edit/main/${path}`;

export const DOCS_URL = '/docs/';
export const GUIDE_URL = '/docs/self-hosting/';
export const SECURITY_URL = '/docs/security/';
export const CONTRIBUTING_URL = '/docs/contributing/';
export const LICENSE_URL = blobUrl('LICENSE');
