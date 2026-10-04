import { cache } from 'react';
import { getDb } from '../db/client';
import type { RegistrationMode } from '../env';
import { describeInstance, type InstanceInfo } from '../instance';
import { mailEnabled } from '../mail/mailer';
import type { Resolved } from '../settings/resolve';
import { readServerSettings } from '../settings/serverSettings';
import { setupNeeded } from '../setup/state';

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

/** §17.4.1: the MCP switch and where it came from, for `/admin/mcp` and `/profile/connectors` (0.4a-3). */
export async function pageMcpSetting(): Promise<Resolved<boolean>> {
  return (await pageSettings()).mcpEnabled;
}

/**
 * Whether the admin configured SMTP, read once per request: the login link, `/recover`, the mobile
 * sign-in line and Profilo's email row all ask, and each asks for the same answer.
 */
export const pageMailEnabled = cache(() => mailEnabled(getDb()));

/** 0.3h: whether the instance still has no account, read once per request by the pages that send to `/setup`. */
export const pageSetupNeeded = cache(() => setupNeeded(getDb()));
