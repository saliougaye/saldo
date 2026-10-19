import type { APIRoute } from 'astro';

/** Spec 0.8a §09: allow all, and name the sitemap with an absolute URL. */
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('/sitemap.xml', site ?? 'http://localhost:4321').href;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
