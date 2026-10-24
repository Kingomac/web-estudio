import { getCollection } from 'astro:content';
import { buildCatalog } from './catalogo.ts';
import type { Catalog } from './catalogo.ts';
import { resourcePath, withBase } from './rutas.ts';
import type { Entry, Resource, SourceReference } from '../schemas/content.ts';

// The collection is immutable during a build; in dev it changes, so rebuild on each request.
let cached: Promise<Catalog> | undefined;
export function siteCatalog(): Promise<Catalog> {
  if (import.meta.env.DEV) return createSiteCatalog();
  return cached ||= createSiteCatalog();
}
async function createSiteCatalog(): Promise<Catalog> {
  const entries = await getCollection('catalogo');
  const files = new Map(entries.flatMap(e => e.filePath ? [[e.data.id, e.filePath] as const] : []));
  return buildCatalog(entries.map(e => e.data), files);
}
export const url = (path: string) => withBase(path, import.meta.env.BASE_URL);
export const resourceUrl = (entity: Resource | Extract<Entry, { kind: 'bimestre' | 'asignatura' }>, catalog: Catalog) => url(resourcePath(entity, catalog.byId));
export function sourceUrl(ref: SourceReference, catalog: Catalog): string {
  const material = catalog.byId.get(ref.materialId);
  if (material?.kind !== 'material') throw new Error(`Material inexistente: ${ref.materialId}`);
  return `${url(material.file)}#page=${ref.pdfPages[0]}`;
}
export const jsonForHtml = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
