/**
 * The server this phone signs in to, typed by the user (§6.29 step 0, §6.30) — not a build input
 * any more. Written by a successful sign-in, removed by «Esci»: its presence is what makes a
 * scheduler exist. Device-local, never synced, emptied by a device reset like the rest of `kv`.
 */
export const SERVER_URL_KEY = 'serverUrl';

/** The last address that worked, kept past «Esci» only to prefill the field. */
export const LAST_SERVER_URL_KEY = 'lastServerUrl';
