// Pure calculations of the ideal op-amp circuits of the course slides (topic 1, pp. 50-64).
// Resistor names follow the slides: R1 input and R2 feedback; in the differential, R3 and R4 divide V2 into V+.

export type Amplifier =
  | { kind: 'inversor'; vi: number; r1: number; r2: number; vcc: number }
  | { kind: 'no-inversor'; vi: number; r1: number; r2: number; vcc: number }
  | { kind: 'diferencial'; v1: number; v2: number; r1: number; r2: number; r3: number; r4: number; vcc: number }
  | { kind: 'instrumentacion'; vip: number; vim: number; r1: number; rg: number; r2: number; r3: number; vcc: number };

export type AmplifierResult = {
  /** Ideal output, ignoring the supply. */
  ideal: number;
  /** Output clipped to ±Vcc (ideal rails). */
  vo: number;
  saturated: boolean;
  /** Voltage at the + input (cortocircuito virtual: also at the − input), when it is meaningful. */
  vplus?: number;
  /** Superposition terms of the differential: A1·V1 and A2·V2. */
  term1?: number;
  term2?: number;
  gain?: number;
};

const positive = (...rs: number[]) => rs.every(r => Number.isFinite(r) && r > 0);

/** Output of the circuit, or null if a resistor is not valid (R3 of the differential may be 0: V2 fixed directly at V+). */
export function amplifier(a: Amplifier): AmplifierResult | null {
  let ideal: number, extra: Partial<AmplifierResult> = {};
  switch (a.kind) {
    case 'inversor':
      if (!positive(a.r1, a.r2)) return null;
      extra = { gain: -a.r2 / a.r1, vplus: 0 };
      ideal = -(a.r2 / a.r1) * a.vi;
      break;
    case 'no-inversor':
      if (!positive(a.r1, a.r2)) return null;
      extra = { gain: 1 + a.r2 / a.r1, vplus: a.vi };
      ideal = (1 + a.r2 / a.r1) * a.vi;
      break;
    case 'diferencial': {
      if (!positive(a.r1, a.r2, a.r4) || !(Number.isFinite(a.r3) && a.r3 >= 0)) return null;
      const vplus = (a.r4 / (a.r3 + a.r4)) * a.v2;
      const term1 = -(a.r2 / a.r1) * a.v1, term2 = (1 + a.r2 / a.r1) * vplus;
      extra = { vplus, term1, term2 };
      ideal = term1 + term2;
      break;
    }
    case 'instrumentacion': {
      if (!positive(a.r1, a.rg, a.r2, a.r3)) return null;
      const gain = (a.r3 / a.r2) * (1 + (2 * a.r1) / a.rg);
      extra = { gain };
      ideal = gain * (a.vip - a.vim);
      break;
    }
  }
  if (![ideal, a.vcc].every(Number.isFinite)) return null;
  const rail = Math.abs(a.vcc);
  const vo = Math.max(-rail, Math.min(rail, ideal));
  return { ideal, vo, saturated: vo !== ideal, ...extra };
}

/** Rg for a target gain of an instrumentation amplifier with unity second stage: G = 1 + 2R1/Rg. */
export const rgForGain = (r1: number, gain: number) => (gain > 1 ? (2 * r1) / (gain - 1) : null);

/** Output due to each mode for a differential gain Ad and a CMRR (as a ratio, not dB). */
export function commonModeError(ad: number, cmrr: number, vd: number, vc: number) {
  const ac = ad / cmrr;
  const differential = ad * vd, common = ac * vc;
  return { ac, differential, common, relative: common / differential };
}
