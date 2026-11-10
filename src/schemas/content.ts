import { z } from 'zod';
import { formats } from '../domain/formatos.ts';
import { matchingRows } from '../domain/notas.ts';

const calendarSourceId = z.string().regex(/^[a-z0-9-]+$/);
const calendarSourceDisplay = { id: calendarSourceId, label: z.string().min(1) };
export const calendarSourcesSchema = z.array(z.discriminatedUnion('kind', [
  z.strictObject({ ...calendarSourceDisplay, kind: z.literal('google'), calendarId: z.string().endsWith('@group.calendar.google.com') }),
  z.strictObject({ ...calendarSourceDisplay, kind: z.literal('moovi') }),
])).min(1).refine(sources => new Set(sources.map(s => s.id)).size === sources.length, 'Fuentes duplicadas.');
const calendarEventBase = {
  id: z.string().min(1), sourceId: calendarSourceId, title: z.string().min(1),
  location: z.string().optional(), url: z.url().startsWith('https://').optional(),
};
export const calendarEventSchema = z.discriminatedUnion('allDay', [
  z.strictObject({ ...calendarEventBase, allDay: z.literal(true), start: z.iso.date(), end: z.iso.date() }),
  z.strictObject({ ...calendarEventBase, allDay: z.literal(false), start: z.iso.datetime(), end: z.iso.datetime() }),
]).refine(e => e.allDay ? e.end > e.start : e.end >= e.start, 'Fin de evento inválido.');
const calendarSourceStateSchema = z.strictObject({
  ...calendarSourceDisplay, status: z.enum(['ok', 'error']),
  checkedAt: z.iso.datetime(), lastSuccessAt: z.iso.datetime().nullable(),
  limitedDetails: z.boolean().default(false),
});
export const calendarSnapshotSchema = z.strictObject({
  version: z.literal(1), timezone: z.literal('Europe/Madrid'),
  from: z.iso.date(), until: z.iso.date(), updatedAt: z.iso.datetime(),
  sources: z.array(calendarSourceStateSchema).min(1),
  events: z.array(calendarEventSchema),
}).superRefine((snapshot, ctx) => {
  if (snapshot.from >= snapshot.until) ctx.addIssue({ code: 'custom', message: 'Intervalo del calendario inválido.' });
  if (new Set(snapshot.sources.map(s => s.id)).size !== snapshot.sources.length) ctx.addIssue({ code: 'custom', message: 'Fuentes duplicadas.' });
  if (new Set(snapshot.events.map(e => e.id)).size !== snapshot.events.length) ctx.addIssue({ code: 'custom', message: 'Eventos duplicados.' });
  if (snapshot.events.some(e => !snapshot.sources.some(s => s.id === e.sourceId))) ctx.addIssue({ code: 'custom', message: 'Fuente de evento desconocida.' });
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type CalendarSnapshot = z.infer<typeof calendarSnapshotSchema>;
export type CalendarSourceId = CalendarSnapshot['sources'][number]['id'];
export type CalendarSources = z.infer<typeof calendarSourcesSchema>;
export const calendarQuerySchema = z.strictObject({
  from: z.iso.date(), to: z.iso.date(),
  sourceIds: z.array(calendarSourceId).min(1).optional(),
  search: z.string().trim().min(1).optional(),
}).refine(query => query.from <= query.to, 'La fecha inicial debe ser anterior o igual a la final.');
export const calendarContextSchema = z.strictObject({
  timezone: z.literal('Europe/Madrid'), query: calendarQuerySchema,
  snapshotUpdatedAt: z.iso.datetime(), coverage: z.strictObject({ from: z.iso.date(), until: z.iso.date() }),
  sources: z.array(calendarSourceStateSchema.extend({
    kind: z.enum(['google', 'moovi']), stale: z.boolean(),
    scope: z.string(), referenceUrl: z.url().startsWith('https://'),
  })),
  events: z.array(calendarEventSchema), warnings: z.array(z.string()),
});
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;

const text = z.string().trim().min(1);
const id = text.regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, 'Usa un ID estable con letras minúsculas, números, puntos y guiones.');
const slug = text.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const ids = z.array(id).refine(xs => new Set(xs).size === xs.length, 'Hay IDs duplicados.');
const httpUrl = z.url().refine(s => /^https?:\/\//.test(s), 'Se requiere una URL HTTP(S).');
const reference = z.strictObject({ materialId: id, pdfPages: z.array(z.number().int().positive()).min(1), label: text.optional() });
const readingReference = z.strictObject({ resourceId: id, anchor: text.regex(/^[a-zA-Z][\w.-]*$/).optional() });
// Complementary sources outside the subject material (RFCs, specifications); never replace page citations.
const externalReference = z.strictObject({ title: text, url: z.url().startsWith('https://') });
const relations = {
  sources: z.array(reference).default([]),
  externalReferences: z.array(externalReference).default([]),
  readingReferences: z.array(readingReference).default([]),
  relatedResourceIds: ids.default([]),
};
const identity = { id, title: text, order: z.number().int().default(0) };
const resource = {
  ...identity, subjectId: id, slug, description: text, scope: text,
  tagIds: ids.min(1),
  aliases: z.array(text.regex(/^\/(?:[a-z0-9-]+\/)+$/)).default([]),
  ...relations,
};
const option = z.strictObject({ id, text, explanation: text });
const fieldBase = { id, label: text, explanation: text };
export const fieldSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...fieldBase, type: z.literal('number'), answer: z.number(), absTol: z.number().nonnegative(), relTol: z.number().nonnegative(), unit: text, decimalPolicy: z.literal('comma-or-point') }),
  z.strictObject({ ...fieldBase, type: z.literal('text'), answers: z.array(text).min(1), normalization: z.strictObject({ trim: z.boolean(), collapseSpaces: z.boolean(), caseSensitive: z.boolean(), accentSensitive: z.boolean() }) }),
  z.strictObject({ ...fieldBase, type: z.literal('select'), options: z.array(z.strictObject({ id, text })).min(2), answer: id }),
  z.strictObject({ ...fieldBase, type: z.literal('format'), format: z.enum(formats), answer: text }),
]);
// At least one citation: a page of the subject material or, for complementary practice, an external reference.
const cited = (e: { originalReferences: unknown[]; externalReferences: unknown[] }) => e.originalReferences.length + e.externalReferences.length > 0;
const citedMessage = { message: 'Cita al menos una página del material original o una referencia complementaria.', path: ['originalReferences'] };
const questionBase = { kind: z.literal('pregunta'), id, subjectId: id, tagIds: ids.min(1), prompt: text, explanation: text, originalReferences: z.array(reference).default([]), ...relations };
export const questionSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...questionBase, type: z.literal('single'), options: z.array(option).min(2), answer: id }),
  z.strictObject({ ...questionBase, type: z.literal('multiple'), options: z.array(option).min(2), answer: ids.min(1) }),
  z.strictObject({ ...questionBase, type: z.literal('ordering'), items: z.array(z.strictObject({ id, text, placementExplanation: text })).min(2), answer: ids.min(2) }),
]).superRefine((q, ctx) => {
  const choices = (q.type === 'ordering' ? q.items : q.options).map(o => o.id);
  if (new Set(choices).size !== choices.length) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Los IDs de alternativas deben ser únicos.' });
  const answers = Array.isArray(q.answer) ? q.answer : [q.answer];
  if (answers.some(a => !choices.includes(a))) ctx.addIssue({ code: 'custom', path: ['answer'], message: 'La solución contiene IDs que no existen.' });
  if (q.type === 'ordering' && answers.length !== choices.length) ctx.addIssue({ code: 'custom', path: ['answer'], message: 'La secuencia debe incluir todos los elementos.' });
  if (!cited(q)) ctx.addIssue({ code: 'custom', ...citedMessage });
});
// Grading rules transcribed from the teaching guide. Declarative: weights, minimums and a cap, no formulas in the data.
// A mark looked up from how many items fell in each category (e.g. A/B/C deliveries). The remainder category never decides.
const countRange = z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).refine(([a, b]) => a <= b, 'Rango invertido.');
const gradeCounts = z.strictObject({
  total: z.number().int().positive(), items: text,
  categories: z.array(z.strictObject({ id, label: text })).min(1),
  remainderLabel: text,
  rows: z.array(z.strictObject({ ranges: z.record(id, countRange), mark: z.number().nonnegative() })).min(1),
});
function* countCombinations(categories: string[], left: number): Generator<Record<string, number>> {
  if (!categories.length) { yield {}; return; }
  const [first, ...rest] = categories;
  for (let n = 0; n <= left; n++) for (const tail of countCombinations(rest, left - n)) yield { [first]: n, ...tail };
}
const gradeComponent = z.strictObject({
  id, label: text, symbol: text.optional(), description: text,
  weight: z.number().positive().max(1), max: z.number().positive().default(10), min: z.number().nonnegative().optional(),
  counts: gradeCounts.optional(),
}).superRefine((c, ctx) => {
  if (!c.counts) return;
  const categories = c.counts.categories.map(k => k.id);
  if (new Set(categories).size !== categories.length) ctx.addIssue({ code: 'custom', path: ['counts', 'categories'], message: 'Categorías duplicadas.' });
  c.counts.rows.forEach((row, i) => {
    if (Object.keys(row.ranges).some(k => !categories.includes(k))) ctx.addIssue({ code: 'custom', path: ['counts', 'rows', i], message: 'Categoría inexistente en la fila.' });
    if (row.mark > c.max) ctx.addIssue({ code: 'custom', path: ['counts', 'rows', i, 'mark'], message: 'La nota supera el máximo de la parte.' });
  });
  for (const values of countCombinations(categories, c.counts.total)) {
    const found = matchingRows(c.counts, values).length;
    if (found !== 1) { ctx.addIssue({ code: 'custom', path: ['counts', 'rows'], message: `${found} filas para ${JSON.stringify(values)}: la tabla debe dar una sola nota a cada combinación.` }); break; }
  }
});
const gradeModality = z.strictObject({
  id, title: text, description: text.optional(),
  components: z.array(gradeComponent).min(1),
  // `geometric` multiplies the marks raised to their weights: a zero in any part gives a zero.
  aggregation: z.enum(['weighted', 'geometric']).default('weighted'),
  // Minimum, out of 10, on the weighted average of several components taken together.
  jointMinimums: z.array(z.strictObject({ id, label: text, componentIds: z.array(id).min(2), min: z.number().nonnegative().max(10) })).default([]),
  // Mark shown when a minimum fails; `belowPassMark` also applies it to any weighted grade under the pass mark.
  // `onlyAbovePass` limits it to grades that would otherwise have passed.
  cap: z.strictObject({ value: z.number().nonnegative(), belowPassMark: z.boolean(), onlyAbovePass: z.boolean().default(false) }),
  // Component whose own mark, out of 10, becomes the final grade when a minimum fails.
  failedMinimumMark: id.optional(),
  guideText: text,
}).superRefine((m, ctx) => {
  if (new Set(m.components.map(c => c.id)).size !== m.components.length) ctx.addIssue({ code: 'custom', path: ['components'], message: 'IDs de componente duplicados.' });
  if (Math.abs(m.components.reduce((sum, c) => sum + c.weight, 0) - 1) > 1e-9) ctx.addIssue({ code: 'custom', path: ['components'], message: 'Los pesos deben sumar 1.' });
  m.components.forEach((c, i) => { if (c.min !== undefined && c.min > c.max) ctx.addIssue({ code: 'custom', path: ['components', i, 'min'], message: 'El mínimo supera la nota máxima.' }); });
  const componentIds = new Set(m.components.map(c => c.id));
  if (m.failedMinimumMark && !componentIds.has(m.failedMinimumMark)) ctx.addIssue({ code: 'custom', path: ['failedMinimumMark'], message: 'Componente inexistente.' });
  m.jointMinimums.forEach((joint, i) => {
    if (componentIds.has(joint.id)) ctx.addIssue({ code: 'custom', path: ['jointMinimums', i, 'id'], message: 'El ID coincide con el de un componente.' });
    if (joint.componentIds.some(c => !componentIds.has(c))) ctx.addIssue({ code: 'custom', path: ['jointMinimums', i, 'componentIds'], message: 'Componente inexistente.' });
  });
});
export const evaluationSchema = z.strictObject({
  source: z.strictObject({ label: text, consultedAt: z.iso.date() }),
  passMark: z.literal(5).default(5),
  modalities: z.array(gradeModality).min(1),
  notes: z.array(text).default([]),
}).refine(e => new Set(e.modalities.map(m => m.id)).size === e.modalities.length, { message: 'IDs de modalidad duplicados.', path: ['modalities'] });
export type Evaluation = z.infer<typeof evaluationSchema>;
export type GradeModality = Evaluation['modalities'][number];
const lecture = <K extends 'apuntes' | 'resumen'>(kind: K) => z.strictObject({ ...resource, kind: z.literal(kind), body: z.enum(['body.mdx', 'body.astro']), printIntent: z.enum(['paper', 'screen']), componentIds: ids.default([]) });
export const entrySchema = z.union([
  z.strictObject({ ...identity, kind: z.literal('bimestre') }),
  z.strictObject({ ...identity, kind: z.literal('asignatura'), slug, bimesterId: id, description: text, teachingGuide: z.strictObject({ url: httpUrl, title: text, academicYear: z.literal('2026/27') }), evaluation: evaluationSchema.optional() }),
  z.strictObject({ ...identity, kind: z.literal('tag'), subjectId: id, slug, type: z.enum(['topic', 'study']) }),
  lecture('apuntes'), lecture('resumen'), questionSchema,
  z.strictObject({ ...resource, kind: z.literal('material'), file: text.regex(/^materiales\/[a-z0-9-]+\/[a-z0-9-]+\.pdf$/), format: z.literal('pdf'), providedName: text, origin: z.strictObject({ label: text, url: httpUrl.optional() }), category: text, pageCount: z.number().int().positive(), sha256: text.regex(/^[a-f0-9]{64}$/) }),
  z.strictObject({ ...resource, kind: z.literal('test'), groups: z.array(z.strictObject({ id, title: text, context: text.optional(), questionIds: ids.min(1) })).min(1) }),
  z.strictObject({
    ...resource, kind: z.literal('ejercicio'), mode: z.literal('form'), prompt: text, explanation: text,
    originalReferences: z.array(reference).default([]), fields: z.array(fieldSchema).min(1),
    hint: text.optional(), steps: z.array(text).default([]),
    // Hex bytes shown in an inspector, and the hops of a packet when the statement follows a path.
    dump: text.regex(/^[0-9a-f]{2}( [0-9a-f]{2})*$/).optional(), path: z.array(text).default([]),
  }).refine(cited, citedMessage),
  z.strictObject({ ...resource, kind: z.literal('ejercicio'), mode: z.literal('workshop'), workshopId: id, prompt: text }),
]);

export type Entry = z.infer<typeof entrySchema>;
export type Question = z.infer<typeof questionSchema>;
export type Field = z.infer<typeof fieldSchema>;
export type Subject = Extract<Entry, { kind: 'asignatura' }>;
export type Tag = Extract<Entry, { kind: 'tag' }>;
export type Reading = Extract<Entry, { kind: 'apuntes' | 'resumen' }>;
export type Material = Extract<Entry, { kind: 'material' }>;
export type Test = Extract<Entry, { kind: 'test' }>;
export type Exercise = Extract<Entry, { kind: 'ejercicio' }>;
export type Resource = Extract<Entry, { scope: string }>;
export type SourceReference = z.infer<typeof reference>;

export function parseEntry(value: unknown) {
  if (value && typeof value === 'object' && 'kind' in value && value.kind === 'pregunta') return questionSchema.safeParse(value);
  return entrySchema.safeParse(value);
}

// Schemas stay serializable so the CLI can expose them to an agent or editor.
export function jsonSchema() {
  return z.toJSONSchema(entrySchema, { unrepresentable: 'any' });
}
