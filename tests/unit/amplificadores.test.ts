import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { amplifier, rgForGain, commonModeError } from '../../src/domain/amplificadores.ts';

const close = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('inversor y no inversor de las diapositivas', () => {
  close(amplifier({ kind: 'inversor', vi: 0.2, r1: 10e3, r2: 100e3, vcc: 15 })!.vo, -2);
  // E1.3 del modelo: no inversor que lleva 0,8 V a 5 V con R1 = 10 kΩ y R2 = 52,5 kΩ.
  const e13 = amplifier({ kind: 'no-inversor', vi: 0.8, r1: 10e3, r2: 52.5e3, vcc: 15 })!;
  close(e13.gain!, 6.25);
  close(e13.vo, 5);
});

test('boletín, ejercicio 3: V2 fija directamente V+ (R3 = 0)', () => {
  const r = amplifier({ kind: 'diferencial', v1: 5, v2: 3, r1: 10e3, r2: 5e3, r3: 0, r4: 3e3, vcc: 15 })!;
  close(r.vplus!, 3);
  close(r.term1!, -2.5);
  close(r.term2!, 4.5);
  close(r.vo, 2);
  assert.equal(r.saturated, false);
});

test('E1.4: diferencial simétrico y saturación a ±15 V', () => {
  const base = { kind: 'diferencial', v1: 1.2, r1: 10e3, r2: 100e3, r3: 10e3, r4: 100e3, vcc: 15 } as const;
  close(amplifier({ ...base, v2: 1.5 })!.vo, 3);
  const sat = amplifier({ ...base, v2: 3 })!;
  close(sat.ideal, 18);
  close(sat.vo, 15);
  assert.equal(sat.saturated, true);
});

test('E1.4: instrumentación, Rg para G = 51 y error por modo común', () => {
  close(rgForGain(25e3, 51)!, 1000);
  assert.equal(rgForGain(25e3, 1), null);
  const r = amplifier({ kind: 'instrumentacion', vip: 2.501, vim: 2.499, r1: 25e3, rg: 1e3, r2: 10e3, r3: 10e3, vcc: 15 })!;
  close(r.gain!, 51);
  close(r.vo, 0.102, 1e-9);
  const cm = commonModeError(51, 1e5, 0.002, 2.5);
  close(cm.differential, 0.102);
  close(cm.common, 1.275e-3);
  close(cm.relative, 0.0125);
});

test('rechaza resistencias no válidas', () => {
  assert.equal(amplifier({ kind: 'inversor', vi: 1, r1: 0, r2: 1, vcc: 15 }), null);
  assert.equal(amplifier({ kind: 'diferencial', v1: 1, v2: 1, r1: 1, r2: 1, r3: -1, r4: 1, vcc: 15 }), null);
});
