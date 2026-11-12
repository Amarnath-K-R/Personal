import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://innovatewithamar.com',
  // Only the homepage is for search; every other page is noindex.
  integrations: [sitemap({ filter: (page) => new URL(page).pathname === '/' })],
  output: 'static',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
