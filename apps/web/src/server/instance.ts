import type { ServerDatabase } from './db/types';
import { env } from './env';
import { instanceName } from './settings/serverSettings';
import { APP_VERSION } from './version';

export interface InstanceInfo {
  /** The resolved instance name (§17.1.8): `INSTANCE_NAME`, else the panel's, else `WEBAUTHN_RP_NAME`. */
  name: string;
  /** The host of `PUBLIC_URL`, shown in the sign-in footer so a person can see where they are. */
  host: string;
  version: string;
}

/** Puts an already-resolved name next to the host and the version. Pages that cache the settings read use this. */
export function describeInstance(name: string): InstanceInfo {
  return { name, host: new URL(env().publicUrl).host, version: APP_VERSION };
}

export async function instanceInfo(db: ServerDatabase): Promise<InstanceInfo> {
  return describeInstance(await instanceName(db));
}
