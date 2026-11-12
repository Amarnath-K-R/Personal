import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://innovatewithamar.com',
  integrations: [sitemap({ filter: (page) => !page.includes('/work/') })],
  output: 'static',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
