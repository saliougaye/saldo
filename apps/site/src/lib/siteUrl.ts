/**
 * D45: the public origin of the build. `SITE_URL` when it is set; on Vercel, the production host
 * that Vercel names; anywhere else, the dev server. No domain is written in the code.
 */
export function siteUrl(env: Readonly<Record<string, string | undefined>>): string {
  const explicit = env.SITE_URL?.trim();
  if (explicit) return explicit;
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:4321';
}
