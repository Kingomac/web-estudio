export const sections = { apuntes: 'apuntes', resumen: 'resumenes', test: 'tests', ejercicio: 'ejercicios', material: 'materiales' };
export const labels = { apuntes: 'Apuntes', resumen: 'Resúmenes', test: 'Tests', ejercicio: 'Ejercicios', material: 'Material original' };
export const kindLabels = { apuntes: 'Apuntes', resumen: 'Resumen', test: 'Test', ejercicio: 'Ejercicio', material: 'Material original' };
export function withBase(path: string, base = '/') {
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
export function resourcePath(entity: Resource | Extract<Entry, { kind: 'bimestre' | 'asignatura' }>, byId: Map<string, Entry>): string {
  if (entity.kind === 'bimestre') return `/bimestres/${entity.id}/`;
  if (entity.kind === 'asignatura') return `/asignaturas/${entity.slug}/`;
  const subject = byId.get(entity.subjectId);
  if (subject?.kind !== 'asignatura') throw new Error(`Asignatura inexistente: ${entity.subjectId}`);
  return `/asignaturas/${subject.slug}/${sections[entity.kind]}/${entity.slug}/`;
}
import type { Entry, Resource } from '../schemas/content.ts';
