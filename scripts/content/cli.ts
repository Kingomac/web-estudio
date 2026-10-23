#!/usr/bin/env bun
import { parseArgs } from 'node:util';
import { writeFile, mkdir, copyFile, unlink, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { loadCatalog, impact, walk, subjectIdOf, titleOf, messageOf } from '../../src/lib/catalogo.ts';
import { parseEntry, jsonSchema } from '../../src/schemas/content.ts';
import { components } from '../../src/lib/registro.ts';
import { template, folders } from './templates.ts';
import type { Scaffold } from './templates.ts';

const { positionals, values } = parseArgs({ allowPositionals: true, options: {
  json: { type: 'boolean' }, help: { type: 'boolean' }, root: { type: 'string' },
  kind: { type: 'string' }, subject: { type: 'string' }, slug: { type: 'string' }, title: { type: 'string' },
  scope: { type: 'string' }, tags: { type: 'string' }, source: { type: 'string' }, data: { type: 'string' },
} });
const command = positionals[0] || 'help';
const root = path.resolve(values.root || process.cwd());
const output = (value: unknown) => {
  if (values.json || typeof value !== 'string') process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  else process.stdout.write(`${value}\n`);
};
const help = `Autoría local para agentes\n\ninspect --source RUTA           Inventariar un archivo o carpeta sin modificarlo\nimport --source PDF --subject ID --slug SLUG --title TITULO --scope ALCANCE --tags ID,ID\nnew --kind TIPO --subject ID --slug SLUG --title TITULO [--scope TEXTO --tags ID,ID]\nnew --data ARCHIVO.json         Crear desde datos completos sin sobrescribir\nlist [--subject ID --kind TIPO] Consultar IDs y archivos existentes\nshow ID                        Leer una entrada y sus relaciones\nimpact ID_O_ARCHIVO             Consultar dependientes directos e indirectos\ncheck                          Validar todos los datos y originales\nreport                         Cobertura temática y posibles duplicados\nschema                         Emitir JSON Schema derivado de Zod\n\nTodos admiten --json. --root permite elegir otro repositorio.\nLas plantillas de new requieren completar y revisar su contenido antes de compilar.\n`;
function required(name: keyof typeof values): string { const value = values[name]; if (typeof value !== 'string' || !value) throw new Error(`Falta --${name}.`); return value; }
function safeSlug(value: string | undefined): string { if (!value || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) throw new Error(`Slug inválido: ${value}`); return value; }
function destination(e: Scaffold) {
  if (e.kind === 'bimestre') return `content/bimestres/${safeSlug(e.id)}.json`;
  if (e.kind === 'asignatura') return `content/asignaturas/${safeSlug(e.id)}/asignatura.json`;
  const prefix = `content/asignaturas/${safeSlug(e.subjectId)}/${folders[e.kind]}`;
  if (!folders[e.kind]) throw new Error('Tipo desconocido.');
  const slug = safeSlug(e.slug || e.id.split('.').at(-1));
  return ['apuntes', 'resumen', 'ejercicio'].includes(e.kind) ? `${prefix}/${slug}/recurso.json` : `${prefix}/${slug}.json`;
}
async function exclusiveJson(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx' });
}
async function main() {
  if (values.help || command === 'help') return output(help);
  if (command === 'schema') return output(jsonSchema());
  if (command === 'inspect') {
    const source = path.resolve(required('source'));
    const files = (await stat(source)).isDirectory() ? await walk(source) : [source];
    const inventory: { path: string; name: string; bytes: number; format: string; pageCount?: number; sha256?: string; error?: string }[] = [];
    for (const file of files) {
      const info: typeof inventory[number] = { path: file, name: path.basename(file), bytes: (await stat(file)).size, format: path.extname(file).slice(1) };
      if (/\.pdf$/i.test(file)) try {
        const bytes = await Bun.file(file).bytes();
        info.pageCount = (await PDFDocument.load(bytes)).getPageCount();
        info.sha256 = createHash('sha256').update(bytes).digest('hex');
      } catch (err) { info.error = messageOf(err); }
      inventory.push(info);
    }
    return output({ source, files: inventory, next: 'Lee los materiales, verifica sus páginas y selecciona los archivos relevantes antes de incorporarlos.' });
  }
  const catalog = await loadCatalog({ root });
  if (command === 'check') {
    output(values.json ? { ok: !catalog.errors.length, entries: catalog.entries.length, errors: catalog.errors } : catalog.errors.length ? catalog.errors.map(e => `${e.file}:${e.field}: ${e.message}`).join('\n') : `Contenido válido: ${catalog.entries.length} entradas.`);
    if (catalog.errors.length) process.exitCode = 1;
    return;
  }
  if (command === 'list') return output({ entries: catalog.entries.filter(e => (!values.subject || subjectIdOf(e) === values.subject || e.id === values.subject) && (!values.kind || e.kind === values.kind)).map(e => ({ id: e.id, kind: e.kind, title: titleOf(e), file: catalog.files.get(e.id), tagIds: 'tagIds' in e ? e.tagIds : [] })), errors: catalog.errors });
  if (command === 'show') {
    const entry = catalog.byId.get(positionals[1]);
    if (!entry) throw new Error('ID no encontrado. Consulta content:list.');
    return output({ entry, file: catalog.files.get(entry.id), references: catalog.edges.filter(e => e.from === entry.id), usedBy: impact(catalog, entry.id) });
  }
  if (command === 'impact') {
    const target = positionals[1];
    const cid = Object.keys(components).find(id => components[id].file === target);
    const id = catalog.byId.has(target) || target?.startsWith('component:') ? target : [...catalog.files].find(([, file]) => file === target)?.[0] || (cid && `component:${cid}`);
    if (!id) throw new Error('ID o archivo no encontrado.');
    return output({ id, dependents: impact(catalog, id) });
  }
  if (command === 'report') {
    const titles = new Map<string, string[]>();
    for (const e of catalog.entries) { const key = `${subjectIdOf(e)}:${e.kind}:${titleOf(e).toLocaleLowerCase('es')}`; titles.set(key, [...(titles.get(key) || []), e.id]); }
    return output({ coverage: catalog.entries.filter(e => e.kind === 'tag').map(tag => ({ id: tag.id, title: titleOf(tag), resources: catalog.entries.filter(e => 'tagIds' in e && e.tagIds.includes(tag.id)).map(e => e.id) })), possibleDuplicates: [...titles.values()].filter(ids => ids.length > 1), errors: catalog.errors });
  }
  if (command === 'new') {
    const data: Scaffold = values.data ? await Bun.file(path.resolve(values.data)).json() : template({ ...values, kind: required('kind'), slug: safeSlug(required('slug')), title: required('title'), tags: values.tags?.split(',').filter(Boolean) || [] });
    if (catalog.byId.has(data.id)) throw new Error(`El ID ya existe: ${data.id}`);
    if (values.data) { const parsed = parseEntry(data); if (!parsed.success) throw new Error(parsed.error.message); }
    const file = destination(data);
    const absolute = path.join(root, file);
    const created: string[] = [];
    try {
      await exclusiveJson(absolute, data); created.push(absolute);
      if (data.body) {
        if (!['body.mdx', 'body.astro'].includes(data.body)) throw new Error('Cuerpo no permitido.');
        const body = path.join(path.dirname(absolute), data.body);
        await writeFile(body, data.body.endsWith('mdx') ? '<h2 id="introduccion">Introducción</h2>\n\nPENDIENTE: redactar a partir de las fuentes verificadas.\n' : '<h2 id="introduccion">Introducción</h2>\n<p>PENDIENTE: redactar a partir de las fuentes verificadas.</p>\n', { flag: 'wx' }); created.push(body);
      }
    } catch (error) { for (const file of created) await unlink(file); throw error; }
    return output({ created: created.map(f => path.relative(root, f)), id: data.id, needsEditorialReview: true, next: 'Completa los campos PENDIENTE, fuentes y cuerpo; ejecuta content:check y bun run check.' });
  }
  if (command === 'import') {
    const source = path.resolve(required('source'));
    if (!/\.pdf$/i.test(source)) throw new Error('Este comando incorpora originales PDF. Otros formatos se leen como entrada y se transforman en lecturas.');
    const subject = safeSlug(required('subject'));
    if (catalog.byId.get(subject)?.kind !== 'asignatura') throw new Error('Crea primero la asignatura.');
    const slug = safeSlug(required('slug'));
    const bytes = await Bun.file(source).bytes();
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const duplicate = catalog.entries.find(e => e.kind === 'material' && e.subjectId === subject && e.sha256 === sha256);
    if (duplicate?.kind === 'material') return output({ existing: duplicate.id, file: duplicate.file, unchanged: true });
    const data = { id: `${subject}.materiales.${slug}`, kind: 'material', subjectId: subject, slug, title: required('title'), description: 'Documento original de la asignatura.', scope: required('scope'), tagIds: required('tags').split(','), order: 0, file: `materiales/${subject}/${slug}.pdf`, format: 'pdf', providedName: path.basename(source), origin: { label: 'Material proporcionado en la asignatura' }, category: 'apuntes-profesor', pageCount: (await PDFDocument.load(bytes)).getPageCount(), sha256 };
    const result = parseEntry(data);
    if (!result.success) throw new Error(result.error.message);
    if (catalog.byId.has(data.id)) throw new Error('Ese ID ya existe. Usa otro para una edición diferente.');
    if (data.tagIds.some(t => { const tag = catalog.byId.get(t); return tag?.kind !== 'tag' || tag.subjectId !== subject; })) throw new Error('Los tags deben existir en la asignatura.');
    const manifest = path.join(root, destination(data));
    const target = path.join(root, 'public', data.file);
    const created: string[] = [];
    try {
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(source, target, constants.COPYFILE_EXCL); created.push(target);
      await exclusiveJson(manifest, data); created.push(manifest);
    } catch (error) { for (const file of created) await unlink(file); throw error; }
    return output({ id: data.id, created: created.map(f => path.relative(root, f)), pageCount: data.pageCount, sha256 });
  }
  throw new Error(`Comando desconocido: ${command}. Usa --help.`);
}
main().catch(error => { output(values.json ? { ok: false, errors: [{ message: error.message }] } : `Error: ${error.message}`); process.exitCode = 1; });
