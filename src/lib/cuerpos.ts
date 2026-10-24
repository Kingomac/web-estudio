import type { Catalog } from './catalogo.ts';
import type { Reading } from '../schemas/content.ts';
export function bodyKey(entry: Reading, catalog: Catalog): string {
  const manifest = catalog.files.get(entry.id);
  if (!manifest) throw new Error(`Manifiesto no encontrado: ${entry.id}`);
  return `/${manifest.replace(/recurso\.json$/, entry.body)}`;
}
