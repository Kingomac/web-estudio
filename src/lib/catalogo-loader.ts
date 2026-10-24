import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Loader } from 'astro/loaders';
import { messageOf, requireCatalog } from './catalogo.ts';

export function catalogLoader(): Loader {
  return {
    name: 'catalogo',
    async load({ config, store, parseData, watcher, logger }) {
      const root = fileURLToPath(config.root);
      const directories = [path.join(root, 'content'), path.join(root, 'public/materiales')];
      async function sync() {
        // Body and PDF checks (hash, page count) run in content:check before every build.
        const catalog = await requireCatalog({ root, checkFiles: false });
        const entries = await Promise.all(catalog.entries.map(async entry => {
          const filePath = catalog.files.get(entry.id)!;
          const data = await parseData({ id: entry.id, data: entry, filePath });
          return { id: entry.id, data, filePath };
        }));
        // Validate the complete catalog before replacing the previous snapshot.
        store.clear();
        for (const entry of entries) store.set(entry);
      }
      await sync();
      if (!watcher) return;
      watcher.add(directories);
      let pending = Promise.resolve();
      watcher.on('all', (event, file) => {
        if (!['add', 'change', 'unlink'].includes(event)) return;
        const absolute = path.resolve(root, file);
        if (!directories.some(directory => absolute.startsWith(`${directory}${path.sep}`))) return;
        // Serialize updates so an older read cannot overwrite a newer catalog.
        pending = pending.then(sync).catch(error => logger.error(messageOf(error)));
      });
    },
  };
}
