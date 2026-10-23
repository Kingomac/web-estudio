import { getCollection } from 'astro:content';
import { buildCatalog } from './catalogo.ts';
import type { Catalog } from './catalogo.ts';
import { resourcePath, withBase } from './rutas.ts';
import type { Entry, Resource, SourceReference } from '../schemas/content.ts';

export async function siteCatalog(): Promise<Catalog> {
  const entries = await getCollection('catalogo');
  return buildCatalog(entries.map(e => e.data));
}
export const url = (path: string) => withBase(path, import.meta.env.BASE_URL);
export const resourceUrl = (entity: Resource | Extract<Entry, { kind: 'bimestre' | 'asignatura' }>, catalog: Catalog) => url(resourcePath(entity, catalog.byId));
export function sourceUrl(ref: SourceReference, catalog: Catalog): string {
  const material = catalog.byId.get(ref.materialId);
  if (material?.kind !== 'material') throw new Error(`Material inexistente: ${ref.materialId}`);
  return `${url(material.file)}#page=${ref.pdfPages[0]}`;
}
export const jsonForHtml = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
