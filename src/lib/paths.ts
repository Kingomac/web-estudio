import { siteCatalog } from './sitio.ts';
import { isResource } from './catalogo.ts';
import type { Resource } from '../schemas/content.ts';
export async function resourcePaths(kind: Resource['kind']) {
  const catalog = await siteCatalog();
  return catalog.entries.filter((e): e is Resource => isResource(e) && e.kind === kind).map(entry => {
    const subject = catalog.byId.get(entry.subjectId);
    if (subject?.kind !== 'asignatura') throw new Error('Asignatura inexistente.');
    return { params: { subject: subject.slug, slug: entry.slug }, props: { entry } };
  });
}
