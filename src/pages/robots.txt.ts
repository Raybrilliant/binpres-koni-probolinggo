import type { APIRoute } from 'astro';
import { SITE } from '../lib/site';

export const GET: APIRoute = () =>
  new Response(
    `User-agent: *
Allow: /
Disallow: /admin

Sitemap: ${SITE.url}/sitemap.xml
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
