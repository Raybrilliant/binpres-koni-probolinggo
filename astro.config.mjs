// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import svelte from '@astrojs/svelte';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  // output "server" = SSR penuh di VPS (Node adapter, mode standalone).
  // Domain produksi utk canonical/OG/sitemap diatur via PUBLIC_SITE_URL di .env
  // dan dibaca src/lib/site.ts.
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),

  server: {
    // WAJIB utk Docker/Dokploy: default `false` = bind localhost sehingga
    // reverse proxy tidak bisa menjangkau → 502. `true` = bind 0.0.0.0.
    // Masih bisa dioverride lewat env HOST saat runtime.
    host: true,
  },

  vite: {
    plugins: [tailwindcss()],
    server: {
      // dev: teruskan API & berkas upload ke backend Elysia di :3000
      proxy: {
        '/api': 'http://localhost:3000',
        '/uploads': 'http://localhost:3000',
      },
    },
  },

  integrations: [svelte()],
});
