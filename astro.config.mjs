import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL || 'https://example.invalid',
  base: process.env.BASE_PATH || '/web-estudio',
  trailingSlash: 'always',
  integrations: [mdx()],
  build: { format: 'directory' },
  server: { host: '127.0.0.1' },
});
