import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { requireCatalog } from '../../src/lib/catalogo.ts';
import { gradeQuestion, gradeField, normalizeText } from '../../src/domain/evaluacion.ts';
import { shuffle, createSession, initialOrder, validSession } from '../../src/domain/sesiones.ts';
import type { Question, Test, Field } from '../../src/schemas/content.ts';

const catalog = await requireCatalog();
const questions = catalog.entries.filter((e): e is Question => e.kind === 'pregunta');
const quiz = catalog.entries.find((e): e is Test => e.kind === 'test')!;
const single = questions.find(q => q.type === 'single')!;
const multiple = questions.find(q => q.type === 'multiple')!;
const ordering = questions.find(q => q.type === 'ordering')!;

test('corrige por ID y rechaza respuestas fuera del contrato', () => {
  assert.equal(gradeQuestion(single, single.answer).correct, true);
  assert.equal(gradeQuestion(single, 'bits-32').correct, false);
  assert.equal(gradeQuestion(single, ['bits-128', 'bits-128']).valid, false);
  assert.equal(gradeQuestion(single, 'opcion-inexistente').valid, false);
  assert.equal(gradeQuestion(single, undefined).correct, false);
});
test('la selección múltiple requiere el conjunto completo, independientemente del orden', () => {
  assert.equal(gradeQuestion(multiple, [...multiple.answer].reverse()).correct, true);
  assert.equal(gradeQuestion(multiple, multiple.answer.slice(1)).correct, false);
  assert.equal(gradeQuestion(multiple, [...multiple.answer, 'broadcast']).correct, false);
  assert.equal(gradeQuestion(multiple, [...multiple.answer, multiple.answer[0]]).correct, false);
});
test('ordenar exige la secuencia completa y no muta las soluciones', () => {
  const original = structuredClone(ordering);
  assert.equal(gradeQuestion(ordering, ordering.answer).correct, true);
  assert.equal(gradeQuestion(ordering, [...ordering.answer].reverse()).correct, false);
  assert.deepEqual(ordering, original);
});
test('mezcla reproducible con grupos intactos y sin mutar las entradas', () => {
  const original = structuredClone({ quiz, questions });
  assert.deepEqual(shuffle(['a', 'b', 'c'], () => 0), ['b', 'c', 'a']);
  const session = createSession(quiz, questions, () => 0);
  assert.equal(validSession(session, quiz, questions), true);
  assert.deepEqual({ quiz, questions }, original);
  for (const g of session.groups) assert.deepEqual([...g.questions].sort(), [...quiz.groups.find(q => q.id === g.id)!.questionIds].sort());
  assert.throws(() => shuffle([1, 2], () => 1), RangeError);
});
test('ordenar nunca empieza resuelto incluso con una fuente aleatoria constante', () => {
  const ordered = { ...ordering, items: ordering.answer.map(id => ordering.items.find(item => item.id === id)!) };
  assert.notDeepEqual(initialOrder(ordered, () => .999), ordered.answer);
});
test('una sesión corrupta se rechaza sin romper la práctica', () => {
  for (const value of [null, [], {}, { groups: [null], answers: {}, orders: {}, checked: [] }]) assert.equal(validSession(value, quiz, questions), false);
  const session = createSession(quiz, questions);
  session.groups[0].questions.push('inventada');
  assert.equal(validSession(session, quiz, questions), false);
  const invalid = createSession(quiz, questions);
  invalid.answers[single.id] = single.answer;
  invalid.checked = [single.id, single.id];
  assert.equal(validSession(invalid, quiz, questions), false);
});
test('números completos, coma decimal, tolerancia y cero', () => {
  const field: Field = { id: 'n', type: 'number', label: 'Número', answer: 1.5, absTol: .01, relTol: 0, unit: 's', decimalPolicy: 'comma-or-point', explanation: 'Razón' };
  assert.equal(gradeField(field, '1,5').correct, true);
  assert.equal(gradeField(field, '1.505').correct, true);
  for (const input of ['', '1.5abc', '1,000.0', 'Infinity', 'NaN', '1 000', '2']) assert.equal(gradeField(field, input).correct, false);
  assert.equal(gradeField({ ...field, answer: 0, absTol: 0 }, '0').correct, true);
  assert.equal(gradeField({ ...field, answer: 0, absTol: 0 }, '.001').correct, false);
});
test('la normalización de texto conserva las diferencias elegidas por el autor', () => {
  const policy = { trim: true, collapseSpaces: true, caseSensitive: true, accentSensitive: true };
  assert.equal(normalizeText('  Árbol   IPv6  ', policy), 'Árbol IPv6');
  assert.notEqual(normalizeText('arbol ipv6', policy), 'Árbol IPv6');
  assert.equal(normalizeText('  Árbol  ', { ...policy, caseSensitive: false, accentSensitive: false }), 'arbol');
});
test('formatos de red: equivalencias IPv6, prefijos, MAC, binario y hex', () => {
  const field = (format: Extract<Field, { type: 'format' }>['format'], answer: string): Field => ({ id: 'f', type: 'format', label: 'Campo', format, answer, explanation: 'Razón' });
  assert.equal(gradeField(field('ipv6', 'fe80::1222:33ff:fe44:5566'), 'FE80:0:0:0:1222:33ff:fe44:5566').correct, true);
  for (const input of ['fe80::1222:33ff:fe44:5567', 'fe80::1::2', 'fe80:::1', '']) assert.equal(gradeField(field('ipv6', 'fe80::1'), input).correct, false);
  assert.equal(gradeField(field('ipv6-expanded', '2001:0db8:0000:0007:0000:0000:000a:0005'), '2001:db8:0:7::a:5').correct, false);
  assert.equal(gradeField(field('ipv6-expanded', '2001:0db8:0000:0007:0000:0000:000a:0005'), '2001:0DB8:0000:0007:0000:0000:000A:0005').correct, true);
  assert.equal(gradeField(field('ipv6-canonical', '2001:db8::a:0:0:b'), '2001:db8:0:0:a::b').correct, false);
  assert.equal(gradeField(field('ipv6-canonical', '2001:db8::a:0:0:b'), '2001:DB8::A:0:0:B').correct, false);
  assert.equal(gradeField(field('ipv6-canonical', '2001:db8::a:0:0:b'), ' 2001:db8::a:0:0:b ').correct, true);
  assert.equal(gradeField(field('prefix', '2000::/62'), '2000:0::/62').correct, true);
  assert.equal(gradeField(field('prefix', '2000::/62'), '2000::/64').correct, false);
  assert.equal(gradeField(field('iid', '1222:33ff:fe44:5566'), '1222:33FF:FE44:5566').correct, true);
  assert.equal(gradeField(field('mac', '33:33:ff:44:55:66'), '33-33-FF-44-55-66').correct, true);
  assert.equal(gradeField(field('bits', '011'), '11').correct, false);
  assert.equal(gradeField(field('hex', 'ff80'), '0xFF 80').correct, true);
  assert.equal(gradeField(field('integer', '16'), '16.0').correct, false);
});
