export const folders: Record<string, string> = { apuntes: 'apuntes', resumen: 'resumenes', pregunta: 'preguntas', test: 'tests', ejercicio: 'ejercicios', material: 'materiales', tag: 'tags' };
export interface Scaffold { id: string; kind: string; subjectId?: string; slug?: string; body?: string; [field: string]: unknown }
export function template({ kind, subject, slug, title, scope, tags = [] }: { kind: string; subject?: string; slug: string; title: string; scope?: string; tags?: string[] }): Scaffold {
  const resource = { id: `${subject}.${folders[kind]}.${slug}`, kind, subjectId: subject, slug, title, description: 'PENDIENTE: describir el recurso.', scope: scope || 'PENDIENTE: delimitar el alcance.', tagIds: tags, order: 0 };
  switch (kind) {
    case 'asignatura': return { id: slug, kind, slug, title, bimesterId: 'b1', order: 0, description: 'PENDIENTE', teachingGuide: { url: '', title: 'Guía docente', academicYear: '2026/27' } };
    case 'bimestre': return { id: slug, kind, title, order: 0 };
    case 'tag': return { id: `${subject}.tags.${slug}`, kind, subjectId: subject, slug, title, type: 'topic', order: 0 };
    case 'apuntes': case 'resumen': return { ...resource, body: 'body.mdx', printIntent: 'paper', sources: [], componentIds: [] };
    case 'pregunta': return { id: resource.id, kind, subjectId: subject, tagIds: tags, type: 'single', prompt: title, options: [{ id: 'opcion-1', text: 'PENDIENTE', explanation: 'PENDIENTE' }, { id: 'opcion-2', text: 'PENDIENTE', explanation: 'PENDIENTE' }], answer: 'opcion-1', explanation: 'PENDIENTE', originalReferences: [] };
    case 'test': return { ...resource, groups: [{ id: 'grupo-1', title: 'Práctica', questionIds: [] }] };
    case 'ejercicio': return { ...resource, mode: 'form', prompt: title, fields: [], explanation: 'PENDIENTE', originalReferences: [] };
    default: throw new Error('Tipo no admitido. Los materiales se incorporan con content:import.');
  }
}
