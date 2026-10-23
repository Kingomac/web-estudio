import { defineCollection } from 'astro:content';
import { entrySchema } from './schemas/content.ts';
import { catalogLoader } from './lib/catalogo-loader.ts';

export const collections = {
  catalogo: defineCollection({
    loader: catalogLoader(),
    schema: entrySchema,
  }),
};
