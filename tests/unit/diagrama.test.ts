import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { analyzePattern, patternValue } from '../../src/domain/diagrama.ts';

const close = (a: number | null, b: number, tol = 1e-3) => assert.ok(a !== null && Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('boletín, problema 1: cos²θ da d = 3 cos²θ, HPBW 90° y FNBW 180°', () => {
  const r = analyzePattern({ kind: 'cosn', n: 2 })!;
  close(r.integral, 2 / 3);
  close(r.directivity, 3);
  close(r.directivityDb, 4.771);
  close(r.hpbw, 90, 0.01);
  close(r.fnbw, 180, 0.01);
  assert.deepEqual(r.maxima, [0, 180]);
});

test('cosⁿθ: la directividad es n + 1 y el haz se estrecha al subir n', () => {
  const r4 = analyzePattern({ kind: 'cosn', n: 4 })!;
  const r8 = analyzePattern({ kind: 'cosn', n: 8 })!;
  close(r4.directivity, 5);
  close(r8.directivity, 9);
  close(r4.hpbw, 2 * Math.acos(0.5 ** (1 / 4)) * 180 / Math.PI, 0.01);
  assert.ok(r8.hpbw! < r4.hpbw!);
  assert.equal(analyzePattern({ kind: 'cosn', n: 3 }), null);
});

test('dipolos de las diapositivas: 1,5 y 1,64', () => {
  const corto = analyzePattern({ kind: 'dipolo-corto' })!;
  close(corto.directivity, 1.5);
  close(corto.hpbw, 90, 0.01);
  close(corto.fnbw, 180, 0.01);
  const media = analyzePattern({ kind: 'dipolo-media-onda' })!;
  close(media.directivity, 1.64, 0.005);
  close(media.hpbw, 78.1, 0.2);
  close(patternValue({ kind: 'dipolo-media-onda' }, 0), 0);
});
