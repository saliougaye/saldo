'use client';

import { createContext } from 'react';

/**
 * How «Elimina» tells the edit form it is running. The control is the form's `deleteControl`, so it
 * renders inside the form and reads this. While it runs, Save waits: the two writes would race, and
 * the loser would show a conflict the user did not cause.
 */
export const DeletingContext = createContext<(deleting: boolean) => void>(() => {});
