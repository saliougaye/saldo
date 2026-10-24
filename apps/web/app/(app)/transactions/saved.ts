'use client';

import { createContext } from 'react';

/**
 * How the edit form tells the page that a save went through: the page shows «Modifiche salvate»
 * (the mockup's toast) while the dialog closes. `TransactionsPanels` holds the toast, so it stays
 * on screen through the navigation that closes the form. Outside it, a save shows nothing.
 */
export const SavedContext = createContext<() => void>(() => {});
