import type { APIRoute } from 'astro';

/** Spec 0.8a §09: one page. `/og/` is not listed: it only feeds the social image. */
export const GET: APIRoute = ({ site }) => {
  const page = new URL('/', site ?? 'http://localhost:4321').href;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${page}</loc></url></urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
