import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { requireCatalog, buildCatalog, impact } from '../../src/lib/catalogo.ts';
import { parseEntry } from '../../src/schemas/content.ts';
import { readingHtml, inlineMarkdown } from '../../src/lib/html.ts';
import { resourcePath, withBase } from '../../src/lib/rutas.ts';

const catalog = await requireCatalog();
test('la muestra atraviesa todos los contratos y resuelve sus fuentes', () => {
  assert.equal(catalog.errors.length, 0);
  for (const kind of ['bimestre', 'asignatura', 'tag', 'material', 'apuntes', 'resumen', 'pregunta', 'test', 'ejercicio']) assert.ok(catalog.entries.some(e => e.kind === kind));
});
test('detecta citas fuera del PDF y referencias inexistentes', () => {
  const entries = structuredClone(catalog.entries);
  const question = entries.find(e => e.kind === 'pregunta')!;
  question.originalReferences[0].pdfPages = [999];
  question.tagIds.push('protocolos.tags.no-existe');
  const errors = buildCatalog(entries).errors;
  assert.ok(errors.some(e => e.field.endsWith('pdfPages')));
  assert.ok(errors.some(e => e.message.includes('no-existe')));
});
test('detecta preguntas repetidas, soluciones inexistentes y explicaciones vacías', () => {
  const entries = structuredClone(catalog.entries);
  const quiz = entries.find(e => e.kind === 'test')!;
  quiz.groups[0].questionIds.push(quiz.groups[0].questionIds[0]);
  assert.ok(buildCatalog(entries).errors.some(e => e.message.includes('una vez')));
  const question = structuredClone(entries.find(e => e.kind === 'pregunta' && e.type === 'single')!);
  if (question.kind !== 'pregunta' || question.type !== 'single') throw new Error('Fixture inválido');
  question.answer = 'no-existe';
  assert.equal(parseEntry(question).success, false);
  question.answer = question.options[0].id;
  question.options[1].explanation = '';
  assert.equal(parseEntry(question).success, false);
});
test('calcula impacto indirecto sobre tests y componentes sin bucles', () => {
  const uses = impact(catalog, 'protocolos.materiales.tema-3-ip-en-iot');
  assert.ok(uses.some(u => u.id === 'protocolos.tests.repaso-ipv6' && u.depth === 2));
  const components = impact(catalog, 'component:protocolos.ndp');
  assert.ok(components.some(u => u.id === 'protocolos.apuntes.ipv6-y-vecinos'));
  const entries = structuredClone(catalog.entries);
  const readings = entries.filter(e => e.kind === 'apuntes' || e.kind === 'resumen');
  readings[0].relatedResourceIds = [readings[1].id]; readings[1].relatedResourceIds = [readings[0].id];
  const result = impact(buildCatalog(entries), readings[0].id);
  assert.equal(new Set(result.map(e => e.id)).size, result.length);
  assert.ok(!result.some(e => e.id === readings[0].id));
});
test('las rutas dependen del slug y conservan el ID; rechaza aliases en conflicto', () => {
  const entries = structuredClone(catalog.entries);
  const reading = entries.find(e => e.kind === 'apuntes')!;
  const id = reading.id;
  reading.slug = 'nuevo-titulo';
  assert.equal(resourcePath(reading, catalog.byId), '/asignaturas/protocolos/apuntes/nuevo-titulo/');
  assert.equal(reading.id, id);
  reading.aliases = ['/asignaturas/protocolos/'];
  assert.ok(buildCatalog(entries).errors.some(e => e.message.includes('Colisión')));
  assert.equal(withBase('/materiales/a.pdf', '/web-estudio/'), '/web-estudio/materiales/a.pdf');
});
test('el índice conserva anclas explícitas y rechaza duplicados', () => {
  const result = readingHtml('<h2 id="estable">Nuevo título</h2><h3>Un apartado</h3><h3>Un apartado</h3>');
  assert.deepEqual(result.headings.map(h => h.id), ['estable', 'un-apartado', 'un-apartado-2']);
  assert.throws(() => readingHtml('<h2 id="a">A</h2><div id="a"></div>'), /duplicada/);
  assert.throws(() => readingHtml('<h1>Otro título</h1>'), /h1/);
});
test('los enunciados admiten formato sin ejecutar HTML', () => {
  const result = inlineMarkdown('**Recuerda** `<script>` <img src=x onerror=alert(1)>');
  assert.ok(result.includes('<strong>Recuerda</strong>'));
  assert.ok(!result.includes('<script>'));
  assert.ok(!result.includes('<img'));
});
