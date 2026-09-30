/**
 * The version reported by `/` and `/api/health`. Hard-coded rather than imported from
 * `package.json`, which a standalone build does not ship next to the compiled route handlers.
 */
export const APP_VERSION = '0.1.0';

/** The protocol version `/api/health` reports; the mobile app checks it before it syncs. */
export const API_VERSION = 1;
