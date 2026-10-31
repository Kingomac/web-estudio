import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeMathml from '@daiji256/rehype-mathml';
import rehypeMathScroll from './src/lib/rehype-math-scroll.ts';

export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL || 'https://example.invalid',
  base: process.env.BASE_PATH || '/web-estudio',
  trailingSlash: 'always',
  // Math is converted to MathML at build time: no client JavaScript.
  markdown: { processor: unified({ remarkPlugins: [remarkMath], rehypePlugins: [rehypeMathml, rehypeMathScroll] }) },
  integrations: [mdx()],
  build: { format: 'directory' },
  server: { host: '127.0.0.1' },
});
