import type { ToolContext } from '@saldo/core';
import { FIXTURE_NOW } from '../../write/fixtures';
import type { Clock } from './shared';

/** «Today» at FIXTURE_NOW (2026-09-29T10:00Z) in Europe/Rome, the fixture user's zone. */
export const FIXTURE_CTX: ToolContext = { today: '2026-09-29', timeZone: 'Europe/Rome' };

export const fixtureClock: Clock = () => FIXTURE_NOW;
