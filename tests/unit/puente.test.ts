import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { bridge, quarterBridge } from '../../src/domain/puente.ts';

const close = (a: number, b: number, tol = 1e-4) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('ejercicio 2 del boletín: equilibrio y salida con R1 un 1 % mayor', () => {
  const base = { va: 5, r2: 100, r3: 350, r4: 80 };
  const balanced = bridge({ ...base, r1: (80 * 100) / 350 })!;
  close(balanced.r1Balance, 22.857, 1e-3);
  assert.equal(balanced.balanced, true);
  close(balanced.vo, 0);
  const shifted = bridge({ ...base, r1: 1.01 * (80 * 100) / 350 })!;
  close(shifted.vx, 1.1197);
  close(shifted.vy, 1.1111);
  close(shifted.vo, 0.0086, 1e-4);
  assert.equal(shifted.balanced, false);
});

test('Pt100 en puente de cuatro resistencias de 100 Ω', () => {
  const at50 = bridge({ va: 5, r1: 119.25, r2: 100, r3: 100, r4: 100 })!;
  close(at50.vo, 0.2195);
  const at100 = bridge({ va: 5, r1: 138.5, r2: 100, r3: 100, r4: 100 })!;
  close(at100.vo, 0.4036);
  close(at100.ix * 1000, 20.964, 1e-3);
});

test('rechaza resistencias nulas, negativas o no numéricas', () => {
  for (const r1 of [0, -5, Number.NaN]) assert.equal(bridge({ va: 5, r1, r2: 1, r3: 1, r4: 1 }), null);
});

test('puente en cuarto: fórmula exacta de las diapositivas y aproximación', () => {
  const q = quarterBridge(5, 120, 0.24);
  close(q.exact * 1000, 2.4975, 1e-4);
  close(q.approx * 1000, 2.5, 1e-9);
  // Must match the full bridge with the sensor in the R1 arm.
  close(bridge({ va: 5, r1: 120.24, r2: 120, r3: 120, r4: 120 })!.vo, q.exact, 1e-12);
});
