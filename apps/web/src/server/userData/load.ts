import type { UserData } from '@saldo/core';
import { cache } from 'react';
import { getDb } from '../db/client';
import { readUserData } from './read';

/**
 * What pages and actions call (§17.1.2). `cache()` makes a layout and a page in the same request
 * share one load instead of reading all of the user's data twice; it lasts one request, so a write is
 * seen by the next one.
 */
export const loadUserData: (userId: string) => Promise<UserData> = cache((userId: string) =>
  readUserData(getDb(), userId),
);
