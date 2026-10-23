import { stat } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';
import { visit } from '../src/lib/html.ts';
import { walk, requireCatalog, isResource } from '../src/lib/catalogo.ts';
import { resourcePath, withBase } from '../src/lib/rutas.ts';

const root = path.resolve('dist');
const base = `/${(process.env.BASE_PATH || '/web-estudio').replace(/^\/+|\/+$/g, '')}`;
const origin = 'https://build.invalid';
const files = await walk(root);
const errors: string[] = [];
const pages = new Map<string, { ids: Set<string>; links: string[] }>();
for (const file of files.filter(f => f.endsWith('.html'))) {
  const document = parse(await Bun.file(file).text());
  const ids = new Set<string>();
  const links: string[] = [];
  visit(document, node => {
    if (!('attrs' in node)) return;
    for (const attr of node.attrs) {
      if (attr.name === 'id') { if (ids.has(attr.value)) errors.push(`${file}: ID duplicado ${attr.value}`); ids.add(attr.value); }
      if (['href', 'src', 'poster'].includes(attr.name) && !/^(https?:|mailto:|tel:|data:|javascript:)/.test(attr.value)) links.push(attr.value);
      if (attr.name === 'srcset') links.push(...attr.value.split(',').map(v => v.trim().split(/\s+/)[0]));
    }
  });
  pages.set(file, { ids, links });
}
for (const [file, page] of pages) {
  const pagePath = withBase(path.relative(root, file).replace(/index\.html$/, ''), base);
  for (const link of page.links) {
    const resolved = new URL(link, `${origin}${pagePath}`);
    if (resolved.origin !== origin) continue;
    if (base !== '/' && resolved.pathname !== base && !resolved.pathname.startsWith(`${base}/`)) { errors.push(`${file}: enlace sin base ${link}`); continue; }
    const relative = decodeURIComponent(resolved.pathname.slice(base === '/' ? 1 : base.length)).replace(/^\//, '');
    let target = path.resolve(root, relative || '.');
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) { errors.push(`${file}: ruta fuera del sitio ${link}`); continue; }
    try {
      if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
      await stat(target);
      const anchor = decodeURIComponent(resolved.hash.slice(1));
      if (anchor && target.endsWith('.html') && !pages.get(target)?.ids.has(anchor)) errors.push(`${file}: ancla inexistente ${link}`);
    } catch { errors.push(`${file}: archivo inexistente ${link}`); }
  }
}
const catalog = await requireCatalog();
for (const edge of catalog.edges.filter(e => e.anchor)) {
  const target = catalog.byId.get(edge.to);
  if (!target || !isResource(target)) continue;
  const file = path.join(root, resourcePath(target, catalog.byId), 'index.html');
  if (!pages.get(file)?.ids.has(edge.anchor!)) errors.push(`${edge.from}:${edge.field}: ancla inexistente ${edge.to}#${edge.anchor}`);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Sitio verificado: ${pages.size} páginas, enlaces, assets y anclas bajo ${base}/.`);
