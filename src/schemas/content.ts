import { z } from 'zod';

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
const relations = {
  sources: z.array(reference).default([]),
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
]);
const questionBase = { kind: z.literal('pregunta'), id, subjectId: id, tagIds: ids.min(1), prompt: text, explanation: text, originalReferences: z.array(reference).min(1), ...relations };
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
});
const lecture = <K extends 'apuntes' | 'resumen'>(kind: K) => z.strictObject({ ...resource, kind: z.literal(kind), body: z.enum(['body.mdx', 'body.astro']), printIntent: z.enum(['paper', 'screen']), componentIds: ids.default([]) });
export const entrySchema = z.union([
  z.strictObject({ ...identity, kind: z.literal('bimestre') }),
  z.strictObject({ ...identity, kind: z.literal('asignatura'), slug, bimesterId: id, description: text, teachingGuide: z.strictObject({ url: httpUrl, title: text, academicYear: z.literal('2026/27') }) }),
  z.strictObject({ ...identity, kind: z.literal('tag'), subjectId: id, slug, type: z.enum(['topic', 'study']) }),
  lecture('apuntes'), lecture('resumen'), questionSchema,
  z.strictObject({ ...resource, kind: z.literal('material'), file: text.regex(/^materiales\/[a-z0-9-]+\/[a-z0-9-]+\.pdf$/), format: z.literal('pdf'), providedName: text, origin: z.strictObject({ label: text, url: httpUrl.optional() }), category: text, pageCount: z.number().int().positive(), sha256: text.regex(/^[a-f0-9]{64}$/) }),
  z.strictObject({ ...resource, kind: z.literal('test'), groups: z.array(z.strictObject({ id, title: text, context: text.optional(), questionIds: ids.min(1) })).min(1) }),
  z.strictObject({ ...resource, kind: z.literal('ejercicio'), mode: z.literal('form'), prompt: text, explanation: text, originalReferences: z.array(reference).min(1), fields: z.array(fieldSchema).min(1) }),
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
