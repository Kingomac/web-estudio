import { loadCatalog } from './catalogo.ts';
import type { Reading } from '../schemas/content.ts';
let files: ReturnType<typeof loadCatalog> | undefined;
export async function bodyKey(entry: Reading): Promise<string> {
  files ||= loadCatalog({ checkFiles: false });
  const catalog = await files;
  const manifest = catalog.files.get(entry.id);
  if (!manifest) throw new Error(`Manifiesto no encontrado: ${entry.id}`);
  return `/${manifest.replace(/recurso\.json$/, entry.body)}`;
}
