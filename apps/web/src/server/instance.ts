import { env } from './env';
import { APP_VERSION } from './version';

export interface InstanceInfo {
  /** `WEBAUTHN_RP_NAME` (§9.2): what the self-hoster called this server. */
  name: string;
  /** The host of `PUBLIC_URL`, shown in the sign-in footer so a person can see where they are. */
  host: string;
  version: string;
}

export function instanceInfo(): InstanceInfo {
  const { rpName, publicUrl } = env();
  return { name: rpName, host: new URL(publicUrl).host, version: APP_VERSION };
}
