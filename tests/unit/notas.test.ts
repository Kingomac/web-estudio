import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { requireCatalog } from '../../src/lib/catalogo.ts';
import { computeGrade, markFromCounts, parseMark } from '../../src/domain/notas.ts';
import { evaluationSchema, parseEntry } from '../../src/schemas/content.ts';
import type { Subject } from '../../src/schemas/content.ts';

const catalog = await requireCatalog();
const modality = (subjectId: string, id: string) => {
  const subject = catalog.byId.get(subjectId) as Subject;
  const found = subject.evaluation?.modalities.find(m => m.id === id);
  if (!found) throw new Error(`Sin modalidad ${subjectId}/${id}`);
  return found;
};
const close = (actual: number | undefined, expected: number) => assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

test('todas las asignaturas del bimestre 1 tienen su evaluación transcrita', () => {
  const b1 = catalog.entries.filter((e): e is Subject => e.kind === 'asignatura' && e.bimesterId === 'b1');
  assert.deepEqual(b1.map(s => s.id).sort(), ['cloud', 'dispositivos', 'embebidos', 'protocolos']);
  for (const subject of b1) assert.ok(subject.evaluation?.modalities.length, subject.id);
});

test('todas las asignaturas del bimestre 2 tienen su evaluación transcrita', () => {
  const b2 = catalog.entries.filter((e): e is Subject => e.kind === 'asignatura' && e.bimesterId === 'b2');
  assert.deepEqual(b2.map(s => s.id).sort(), ['arquitecturas', 'datos', 'innovacion', 'redes']);
  for (const subject of b2) assert.ok(subject.evaluation?.modalities.length, subject.id);
});

test('Redes: media geométrica, un cero suspende y calcula la nota necesaria', () => {
  const ac = modality('redes', 'continua');
  close(computeGrade(ac, { preguntas: 6, informes: 8, trabajo: 7 }).final, 6 ** 0.4 * 8 ** 0.4 * 7 ** 0.2);
  const zero = computeGrade(ac, { preguntas: 0, informes: 10, trabajo: 10 });
  close(zero.final, 0);
  assert.equal(zero.passed, false);
  const needed = computeGrade(ac, { preguntas: 5, informes: 5 }).needed;
  assert.deepEqual(needed, { componentId: 'trabajo', value: 5 });
  assert.equal(computeGrade(ac, { preguntas: 0, informes: 10 }).needed?.value, null);
  close(computeGrade(modality('redes', 'global'), { preguntas: 6, informes: 8, dossier: 5, trabajo: 7 }).final, 6 ** 0.4 * 8 ** 0.3 * 5 ** 0.1 * 7 ** 0.2);
});

test('Ingeniería de datos: mínimo conjunto de 4 en continua y trabajo tutelado', () => {
  const ordinaria = modality('datos', 'ordinaria');
  const low = computeGrade(ordinaria, { examen: 10, continua: 3, tutelado: 4 });
  assert.deepEqual(low.failedMinimums, ['trabajos']);
  assert.equal(low.passed, false);
  // Un 2 compensado con un 6 alcanza justo la media conjunta de 4.
  assert.deepEqual(computeGrade(ordinaria, { examen: 10, continua: 2, tutelado: 6 }).failedMinimums, []);
  assert.equal(computeGrade(ordinaria, { examen: 10, continua: 2, tutelado: 6 }).passed, true);
  // Con examen de 10 basta el 5 global, pero el mínimo conjunto exige 8 en tutelado.
  assert.deepEqual(computeGrade(ordinaria, { examen: 10, continua: 0 }).needed, { componentId: 'tutelado', value: 8 });
  assert.deepEqual(computeGrade(ordinaria, { examen: 3.9, continua: 10, tutelado: 10 }).failedMinimums, ['examen']);
});

test('Innovación: examen y trabajo práctico se superan por separado', () => {
  const ordinaria = modality('innovacion', 'ordinaria');
  close(computeGrade(ordinaria, { examen: 5, practico: 5, seguimiento: 0 }).final, 4);
  const failed = computeGrade(ordinaria, { examen: 4.9, practico: 10, seguimiento: 10 });
  assert.deepEqual(failed.failedMinimums, ['examen']);
  assert.equal(failed.passed, false);
  assert.equal(computeGrade(ordinaria, { examen: 5, practico: 5, seguimiento: 5 }).passed, true);
});

test('Nuevas arquitecturas: la segunda oportunidad depende de conservar notas', () => {
  close(computeGrade(modality('arquitecturas', 'primera'), { practicas: 5, objetiva: 6, tutelado: 7 }).final, 2 + 2.4 + 1.4);
  close(computeGrade(modality('arquitecturas', 'segunda-conservando'), { practicas: 5, mixta: 6, tutelado: 7 }).final, 2 + 2.4 + 1.4);
  close(computeGrade(modality('arquitecturas', 'segunda-sin-conservar'), { mixta: 5, tutelado: 7 }).final, 3 + 2.8);
});

test('rechaza mínimos conjuntos sobre componentes inexistentes', () => {
  const base = modality('datos', 'ordinaria');
  const evaluation = { source: { label: 'x', consultedAt: '2026-11-09' }, modalities: [{ ...base, jointMinimums: [{ id: 'j', label: 'J', componentIds: ['examen', 'nada'], min: 4 }] }] };
  assert.equal(evaluationSchema.safeParse(evaluation).success, false);
});

test('todas las asignaturas del bimestre 3 tienen su evaluación transcrita', () => {
  const b3 = catalog.entries.filter((e): e is Subject => e.kind === 'asignatura' && e.bimesterId === 'b3');
  assert.deepEqual(b3.map(s => s.id).sort(), ['aprendizaje', 'ciberseguridad', 'green', 'integracion']);
  for (const subject of b3) assert.ok(subject.evaluation?.modalities.length, subject.id);
});

test('Aprendizaje automático: mínimo de 4 por parte con tope de 4 si falla', () => {
  const ordinaria = modality('aprendizaje', 'ordinaria');
  close(computeGrade(ordinaria, { examen: 6, practicas: 7, tutelado: 8 }).final, 2.4 + 2.45 + 2);
  const capped = computeGrade(ordinaria, { examen: 3.9, practicas: 10, tutelado: 10 });
  close(capped.final, 4);
  assert.equal(capped.passed, false);
  close(computeGrade(ordinaria, { examen: 3, practicas: 3, tutelado: 3 }).final, 3);
});

test('Ciberseguridad: sin el 4 en el examen, la nota final es la del examen', () => {
  const primera = modality('ciberseguridad', 'primera');
  close(computeGrade(primera, { seguimiento: 7, objetiva: 5, practica: 7, tutelados: 7 }).final, 1.4 + 2 + 1.4 + 1.4);
  const failed = computeGrade(primera, { seguimiento: 10, objetiva: 3.5, practica: 10, tutelados: 10 });
  close(failed.final, 3.5);
  assert.equal(failed.passed, false);
  assert.equal(failed.capped, false);
  close(computeGrade(modality('ciberseguridad', 'segunda'), { objetiva: 2, practica: 10 }).final, 2);
});

test('Integración: el 4,5 solo se aplica si la suma habría aprobado', () => {
  const primera = modality('integracion', 'primera');
  const capped = computeGrade(primera, { tutelados: 10, objetiva: 4, practicas: 10 });
  close(capped.points, 7.6);
  close(capped.final, 4.5);
  assert.equal(capped.passed, false);
  const below = computeGrade(primera, { tutelados: 5, objetiva: 4, practicas: 5 });
  close(below.final, 4.6);
  assert.equal(below.passed, false);
  close(computeGrade(modality('integracion', 'segunda'), { mixta: 6 }).final, 6);
});

test('Green IoT: segunda oportunidad conservando notas o no', () => {
  close(computeGrade(modality('green', 'primera'), { practicas: 5, objetiva: 6, problemas: 7, tutelados: 8 }).final, 1 + 2.4 + 0.7 + 2.4);
  close(computeGrade(modality('green', 'segunda-conservando'), { practicas: 5, mixta: 6, tutelados: 8 }).final, 1 + 3 + 2.4);
  close(computeGrade(modality('green', 'segunda-sin-conservar'), { mixta: 5, tutelados: 8 }).final, 3.5 + 2.4);
});

test('Gemelos digitales: mínimo de 4 por parte con tope de 4 si falla', () => {
  const ordinaria = modality('gemelos', 'ordinaria');
  close(computeGrade(ordinaria, { mixta: 6, problemas: 7, tutelados: 8 }).final, 2.4 + 1.75 + 2.8);
  const capped = computeGrade(ordinaria, { mixta: 10, problemas: 3.9, tutelados: 10 });
  close(capped.final, 4);
  assert.deepEqual(capped.failedMinimums, ['problemas']);
  assert.equal(capped.passed, false);
  close(computeGrade(ordinaria, { mixta: 3, problemas: 3, tutelados: 3 }).final, 3);
});

test('lee notas con coma o punto y rechaza valores fuera de escala', () => {
  assert.equal(parseMark('', 10), undefined);
  assert.equal(parseMark(' 7,5 ', 10), 7.5);
  assert.equal(parseMark('7.5', 10), 7.5);
  assert.equal(parseMark('10,01', 10), 'invalid');
  assert.equal(parseMark('-1', 10), 'invalid');
  assert.equal(parseMark('4,5e1', 400), 'invalid');
  assert.equal(parseMark('350', 400), 350);
});

test('Dispositivos: media ponderada, mínimo en NExam y tope de 4,9 por debajo del 5', () => {
  const ac = modality('dispositivos', 'continua');
  const ok = computeGrade(ac, { examen: 6, ejercicios: 8, practicas: 7 });
  close(ok.final, 6 * 0.55 + 0.8 + 7 * 0.35);
  assert.equal(ok.passed, true);
  const low = computeGrade(ac, { examen: 3.5, ejercicios: 10, practicas: 10 });
  close(low.points, 1.925 + 1 + 3.5);
  close(low.final, 4.9);
  assert.deepEqual(low.failedMinimums, ['examen']);
  assert.equal(low.capped, true);
  // 4,95 sin llegar al 5 también se limita a 4,9, como dice la guía.
  close(computeGrade(ac, { examen: 5, ejercicios: 6, practicas: 4.428571428571429 }).final, 4.9);
});

test('Protocolos: PM sobre 400 y tope de 4,0 solo si el examen final no llega a 4', () => {
  const ac = modality('protocolos', 'continua');
  close(computeGrade(ac, { 'examen-final': 6, 'prueba-intermedia': 5, moovi: 300 }).final, 2.4 + 1 + 3);
  const capped = computeGrade(ac, { 'examen-final': 3, 'prueba-intermedia': 10, moovi: 400 });
  close(capped.points, 7.2);
  close(capped.final, 4);
  assert.equal(capped.passed, false);
  // Con EF ≥ 4, un 4,9 de media se mantiene: no hay tope bajo el aprobado.
  close(computeGrade(ac, { 'examen-final': 4, 'prueba-intermedia': 4.5, moovi: 168 }).final, 1.6 + 0.9 + 1.68);
});

test('Cloud: mínimo del 40 % en teoría y nota máxima de 4 al suspender', () => {
  const first = modality('cloud', 'primera');
  close(computeGrade(first, { entregas: 2, teoria: 3.9, practicas: 10 }).final, 4);
  const below = computeGrade(first, { entregas: 0.75, teoria: 4.5, practicas: 4.5 });
  close(below.final, 4);
  assert.equal(below.passed, false);
  // Las entregas puntúan sobre 2: 1,75 de la tabla son 1,75 puntos de la nota final.
  close(computeGrade(first, { entregas: 1.75, teoria: 5, practicas: 6 }).final, 1.75 + 2 + 2.4);
});

test('Cloud: la nota de entregas sale de la tabla según el número de A y de C', () => {
  const counts = modality('cloud', 'primera').components.find(c => c.id === 'entregas')!.counts!;
  const mark = (a: string, c: string) => markFromCounts(counts, { a, c });
  assert.equal(mark('15', '0'), 2);
  assert.equal(mark('11', '0'), 2);
  assert.equal(mark('10', '0'), 1.75);
  assert.equal(mark('0', '0'), 1.25);
  assert.equal(mark('12', '3'), 1.5);
  assert.equal(mark('9', '2'), 1.25);
  assert.equal(mark('11', '4'), 1);
  assert.equal(mark('8', '7'), 0.75);
  assert.equal(mark('5', '9'), 0.25);
  assert.equal(mark('3', '10'), 0);
  assert.equal(mark('0', '11'), 0);
  assert.equal(mark('', '2'), undefined);
  assert.equal(mark('12', '4'), 'invalid');
  assert.equal(mark('1,5', '0'), 'invalid');
  assert.equal(mark('-1', '0'), 'invalid');
});

test('el contrato exige que la tabla dé una sola nota a cada combinación de A y C', () => {
  const subject = structuredClone(catalog.byId.get('cloud')) as Subject;
  const counts = subject.evaluation!.modalities[0].components.find(c => c.id === 'entregas')!.counts!;
  const rows = structuredClone(counts.rows);
  counts.rows = rows.filter(r => r.mark !== 1 || r.ranges.a?.[0] !== 11);
  assert.equal(parseEntry(subject).success, false, 'falta la fila de 11 A y 4 C');
  counts.rows = [...rows, { ranges: { c: [0, 0] }, mark: 2 }];
  assert.equal(parseEntry(subject).success, false, 'filas solapadas');
  counts.rows = rows.map(r => r.mark === 2 ? { ...r, mark: 3 } : r);
  assert.equal(parseEntry(subject).success, false, 'nota por encima del máximo');
  counts.rows = rows;
  assert.equal(parseEntry(subject).success, true);
});

test('Sistemas embebidos: las tres partes deben llegar a 4', () => {
  const ac = modality('embebidos', 'continua-ordinaria');
  const result = computeGrade(ac, { practicas: 9, informes: 3.9, proyecto: 9 });
  close(result.final, 4.9);
  assert.deepEqual(result.failedMinimums, ['informes']);
  assert.equal(computeGrade(ac, { practicas: 5, informes: 5, proyecto: 5 }).passed, true);
});

test('con una nota pendiente calcula la mínima para aprobar, respetando su mínimo', () => {
  const ac = modality('dispositivos', 'continua');
  const needed = computeGrade(ac, { ejercicios: 10, practicas: 10 }).needed;
  assert.deepEqual(needed, { componentId: 'examen', value: 4 });
  const moreNeeded = computeGrade(ac, { ejercicios: 5, practicas: 5 }).needed;
  assert.equal(moreNeeded?.value, Math.ceil((5 - 0.5 - 1.75) / 0.55 * 100) / 100);
  const result = computeGrade(ac, { examen: moreNeeded!.value!, ejercicios: 5, practicas: 5 });
  assert.equal(result.passed, true);
  assert.equal(computeGrade(ac, { examen: 0, ejercicios: 0 }).needed?.value, null);
  assert.equal(computeGrade(modality('protocolos', 'continua'), { 'examen-final': 5, 'prueba-intermedia': 5 }).needed?.value, 200);
  // Un mínimo ya suspendido impide aprobar aunque falte otra parte.
  assert.equal(computeGrade(modality('embebidos', 'continua-ordinaria'), { practicas: 3, informes: 10 }).needed?.value, null);
});

test('el contrato rechaza pesos que no suman 1, mínimos fuera de escala e IDs repetidos', () => {
  const base = { source: { label: 'Guía', consultedAt: '2026-11-03' }, modalities: [{ id: 'm', title: 'M', guideText: 'Texto', cap: { value: 4.9, belowPassMark: true }, components: [{ id: 'a', label: 'A', description: 'D', weight: 0.6 }, { id: 'b', label: 'B', description: 'D', weight: 0.4, min: 4 }] }] };
  assert.equal(evaluationSchema.safeParse(base).success, true);
  const broken = (change: (value: typeof base) => void) => { const copy = structuredClone(base); change(copy); return evaluationSchema.safeParse(copy).success; };
  assert.equal(broken(v => { v.modalities[0].components[0].weight = 0.5; }), false);
  assert.equal(broken(v => { v.modalities[0].components[1].min = 11; }), false);
  assert.equal(broken(v => { v.modalities[0].components[1].id = 'a'; }), false);
  assert.equal(broken(v => { v.modalities.push(structuredClone(v.modalities[0])); }), false);
  const subject = structuredClone(catalog.byId.get('embebidos'));
  assert.equal(parseEntry(subject).success, true);
});
