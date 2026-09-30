import { cache } from 'react';
import { getDb } from '../db/client';
import type { RegistrationMode } from '../env';
import { describeInstance, type InstanceInfo } from '../instance';
import { readServerSettings } from '../settings/serverSettings';

/**
 * §17.1.8 for pages: the settings read once per request, however many of these a layout and its
 * page ask for. Route handlers and auth hooks do not use this — they query directly.
 */
const pageSettings = cache(() => readServerSettings(getDb()));

export async function pageRegistrationMode(): Promise<RegistrationMode> {
  return (await pageSettings()).registration.value;
}

export async function pageInstanceInfo(): Promise<InstanceInfo> {
  return describeInstance((await pageSettings()).instanceName.value);
}
