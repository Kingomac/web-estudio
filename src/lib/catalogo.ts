import { readdir, readFile, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { parseEntry } from '../schemas/content.ts';
import type { Entry, Resource, Subject } from '../schemas/content.ts';
import { components, workshops } from './registro.ts';
import { resourcePath, sections } from './rutas.ts';

export interface ContentError { id?: string; file: string; field: string; message: string }
export interface Edge { from: string; to: string; field: string; anchor?: string; pages?: number[] }
export interface Catalog { entries: Entry[]; byId: Map<string, Entry>; files: Map<string, string>; edges: Edge[]; errors: ContentError[] }
export const compare = (a: { id: string; order?: number; title?: string }, b: { id: string; order?: number; title?: string }) => (a.order || 0) - (b.order || 0) || (a.title || a.id).localeCompare(b.title || b.id, 'es');
export const isResource = (e: Entry): e is Resource => Object.hasOwn(sections, e.kind);
export const subjectIdOf = (e: Entry): string | undefined => 'subjectId' in e ? e.subjectId : undefined;
export const titleOf = (e: Entry): string => 'title' in e ? e.title : e.prompt;
export const messageOf = (error: unknown): string => error instanceof Error ? error.message : String(error);
export async function walk(directory: string): Promise<string[]> {
  const output: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'assets') continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(file));
    else if (entry.isFile()) output.push(file);
  }
  return output.sort();
}
export function buildCatalog(entries: Entry[], files = new Map<string, string>()): Catalog {
  const errors: ContentError[] = [];
  const byId = new Map<string, Entry>();
  const edges: Edge[] = [];
  const issue = (entity: Entry, field: string, message: string) => errors.push({ id: entity.id, file: files.get(entity.id) || '', field, message });
  for (const entity of entries) {
    if (byId.has(entity.id)) issue(entity, 'id', 'ID duplicado en el catálogo.');
    else byId.set(entity.id, entity);
  }
  function reference(entity: Entry, targetId: string, field: string, kinds: Entry['kind'][], extra: Pick<Edge, 'anchor' | 'pages'> = {}) {
    const target = byId.get(targetId);
    if (!target || !kinds.includes(target.kind)) issue(entity, field, `Referencia inválida: ${targetId}. Se esperaba ${kinds.join(' o ')}.`);
    else if (subjectIdOf(entity) && subjectIdOf(target) && subjectIdOf(entity) !== subjectIdOf(target)) issue(entity, field, 'La referencia pertenece a otra asignatura.');
    edges.push({ from: entity.id, to: targetId, field, ...extra });
  }
  const routes = new Map([['/', 'inicio']]);
  for (const e of entries.filter((e): e is Subject => e.kind === 'asignatura')) {
    for (const section of Object.values(sections)) routes.set(`/asignaturas/${e.slug}/${section}/`, e.id);
  }
  const tagSlugs = new Set();
  for (const e of entries) {
    if ('subjectId' in e) reference(e, e.subjectId, 'subjectId', ['asignatura']);
    if (e.kind === 'asignatura') reference(e, e.bimesterId, 'bimesterId', ['bimestre']);
    if (e.kind === 'tag') {
      const key = `${e.subjectId}/${e.slug}`;
      if (tagSlugs.has(key)) issue(e, 'slug', 'Slug de etiqueta duplicado en la asignatura.');
      tagSlugs.add(key);
    }
    for (const [i, tag] of ('tagIds' in e ? e.tagIds : []).entries()) reference(e, tag, `tagIds.${i}`, ['tag']);
    const referenceLists = { sources: 'sources' in e ? e.sources : [], originalReferences: 'originalReferences' in e ? e.originalReferences : [] };
    for (const field of ['sources', 'originalReferences'] as const) for (const [i, ref] of referenceLists[field].entries()) {
      reference(e, ref.materialId, `${field}.${i}`, ['material'], { pages: ref.pdfPages });
      const material = byId.get(ref.materialId);
      if (material?.kind === 'material' && ref.pdfPages.some(p => p > material.pageCount)) issue(e, `${field}.${i}.pdfPages`, `La cita supera las ${material.pageCount} páginas del PDF.`);
    }
    for (const [i, ref] of ('readingReferences' in e ? e.readingReferences : []).entries()) reference(e, ref.resourceId, `readingReferences.${i}`, ['apuntes', 'resumen'], { anchor: ref.anchor });
    for (const [i, id] of ('relatedResourceIds' in e ? e.relatedResourceIds : []).entries()) reference(e, id, `relatedResourceIds.${i}`, Object.keys(sections) as Resource['kind'][]);
    const componentIds = [...('componentIds' in e ? e.componentIds : []), ...(e.kind === 'ejercicio' && e.mode === 'workshop' ? [workshops[e.workshopId]] : [])];
    if (e.kind === 'ejercicio' && e.mode === 'workshop' && !workshops[e.workshopId]) issue(e, 'workshopId', 'Taller no registrado.');
    for (const cid of componentIds) {
      if (!components[cid]) issue(e, 'componentIds', `Componente no registrado: ${cid}.`);
      else edges.push({ from: e.id, to: `component:${cid}`, field: 'componentIds' });
    }
    if (e.kind === 'test') {
      const questionIds = e.groups.flatMap(g => g.questionIds);
      if (new Set(questionIds).size !== questionIds.length) issue(e, 'groups', 'Una pregunta solo puede aparecer una vez en cada test.');
      if (new Set(e.groups.map(g => g.id)).size !== e.groups.length) issue(e, 'groups', 'IDs de grupo duplicados.');
      questionIds.forEach(q => reference(e, q, 'groups.questionIds', ['pregunta']));
      const topic = (id: string) => { const tag = byId.get(id); return tag?.kind === 'tag' && tag.type === 'topic'; };
      const topics = new Set(questionIds.flatMap(q => { const entry = byId.get(q); return entry && 'tagIds' in entry ? entry.tagIds : []; }).filter(topic));
      const declared = e.tagIds.filter(topic);
      if (topics.size !== declared.length || declared.some(t => !topics.has(t))) issue(e, 'tagIds', 'Los tags de tema deben ser la unión de los temas de sus preguntas.');
    }
    if (e.kind === 'ejercicio' && e.mode === 'form') {
      if (new Set(e.fields.map(f => f.id)).size !== e.fields.length) issue(e, 'fields', 'IDs de campo duplicados.');
      for (const f of e.fields) if (f.type === 'select' && (new Set(f.options.map(o => o.id)).size !== f.options.length || !f.options.some(o => o.id === f.answer))) issue(e, `fields.${f.id}`, 'Opciones duplicadas o respuesta inexistente.');
    }
    if ((isResource(e) && byId.get(e.subjectId)?.kind === 'asignatura') || e.kind === 'bimestre' || e.kind === 'asignatura') {
      for (const route of [resourcePath(e, byId), ...('aliases' in e ? e.aliases : [])]) {
        if (routes.has(route)) issue(e, 'slug/aliases', `Colisión de ruta: ${route} (${routes.get(route)}).`);
        routes.set(route, e.id);
      }
    }
  }
  return { entries: entries.toSorted(compare), byId, files, edges, errors };
}

export function impact(catalog: Catalog, target: string) {
  const visited = new Set([target]);
  const found: { id: string; file?: string; field: string; depth: number; via: string }[] = [];
  const queue = [{ id: target, depth: 0 }];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of catalog.edges.filter(e => e.to === current.id)) {
      if (visited.has(edge.from)) continue;
      visited.add(edge.from);
      found.push({ id: edge.from, file: catalog.files.get(edge.from), field: edge.field, depth: current.depth + 1, via: current.id });
      queue.push({ id: edge.from, depth: current.depth + 1 });
    }
  }
  return found;
}

export async function loadCatalog({ root = process.cwd(), checkFiles = true }: { root?: string; checkFiles?: boolean } = {}): Promise<Catalog> {
  const entries: Entry[] = [];
  const files = new Map<string, string>();
  const parseErrors: ContentError[] = [];
  const allFiles = await walk(path.join(root, 'content'));
  for (const file of allFiles.filter(f => f.endsWith('.json'))) {
    const relative = path.relative(root, file);
    try {
      const raw = JSON.parse(await readFile(file, 'utf8'));
      if (JSON.stringify(raw).includes('PENDIENTE')) parseErrors.push({ id: raw.id, file: relative, field: '', message: 'Hay campos PENDIENTE. Completa y revisa la plantilla.' });
      const result = parseEntry(raw);
      if (!result.success) {
        const issues: typeof result.error.issues = [];
        for (const issue of result.error.issues) {
          if (issue.code !== 'invalid_union') issues.push(issue);
          else {
            const relevant = issue.errors.find(branch => !branch.some(i => i.code === 'invalid_value' && ['kind', 'mode'].includes(String(i.path[0]))));
            issues.push(...(relevant || [issue]));
          }
        }
        parseErrors.push(...(issues.length ? issues : result.error.issues).slice(0, 12).map(i => ({ id: raw.id, file: relative, field: i.path.join('.'), message: i.message })));
      } else { entries.push(result.data); files.set(result.data.id, relative); }
    } catch (err) { parseErrors.push({ file: relative, field: '', message: messageOf(err) }); }
  }
  const catalog = buildCatalog(entries, files);
  catalog.errors.unshift(...parseErrors);
  if (checkFiles) for (const e of entries) {
    const fail = (field: string, message: string) => catalog.errors.push({ id: e.id, file: files.get(e.id)!, field, message });
    if ('body' in e) {
      const directory = path.dirname(path.join(root, files.get(e.id)!));
      for (const name of ['body.astro', 'body.mdx']) {
        const exists = await stat(path.join(directory, name)).then(() => true, () => false);
        if (name === e.body && !exists) fail('body', 'No existe el cuerpo de la lectura.');
        if (name !== e.body && exists) fail('body', 'Hay dos cuerpos para una lectura.');
      }
      try {
        const resolved = await realpath(path.join(directory, e.body));
        if (!resolved.startsWith(`${await realpath(directory)}${path.sep}`)) fail('body', 'El cuerpo sale de la carpeta del recurso.');
        const source = await readFile(resolved, 'utf8');
        if (source.includes('PENDIENTE')) fail('body', 'Hay contenido PENDIENTE en el cuerpo. Completa y revisa la plantilla.');
        for (const [cid, definition] of Object.entries(components)) {
          const filename = path.basename(definition.file);
          if (source.includes(filename) && !(e.componentIds || []).includes(cid)) fail('componentIds', `Declara el componente ${cid} utilizado en el cuerpo.`);
        }
      } catch { /* Missing bodies already reported above. */ }
    }
    if (e.kind === 'material') try {
      const filepath = path.join(root, 'public', e.file);
      const resolved = await realpath(filepath);
      if (!resolved.startsWith(`${await realpath(path.join(root, 'public', 'materiales'))}${path.sep}`)) throw new Error('El PDF sale de public/materiales.');
      const bytes = await readFile(filepath);
      const pdf = await PDFDocument.load(bytes);
      if (pdf.getPageCount() !== e.pageCount) fail('pageCount', `El PDF tiene ${pdf.getPageCount()} páginas.`);
      if (createHash('sha256').update(bytes).digest('hex') !== e.sha256) fail('sha256', 'El original ha cambiado. Incorpora una nueva edición con otro ID.');
    } catch (err) { fail('file', `No se puede leer el PDF: ${messageOf(err)}`); }
  }
  return catalog;
}

export async function requireCatalog(options?: { root?: string; checkFiles?: boolean }) {
  const catalog = await loadCatalog(options);
  if (catalog.errors.length) throw new Error(catalog.errors.map(e => `${e.file}:${e.field}: ${e.message}`).join('\n'));
  return catalog;
}
