import type { APIRoute } from 'astro';
import { SITE } from '../lib/site';

// Sitemap manual: dengan output "server" tidak ada halaman prerender,
// jadi integrasi @astrojs/sitemap tidak menghasilkan apa pun.
const BUILT_AT = new Date().toISOString().slice(0, 10);

export const GET: APIRoute = () =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE.url}/</loc>
    <lastmod>${BUILT_AT}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
