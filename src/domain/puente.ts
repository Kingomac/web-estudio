// Pure calculations of the Wheatstone bridge with the numbering of the course slides:
// R4 top-left, R1 bottom-left (Vx), R3 top-right, R2 bottom-right (Vy), supply on top and ground below.

export type Bridge = { va: number; r1: number; r2: number; r3: number; r4: number };

/** Midpoint voltages, output Vo = Vx − Vy, branch currents and the R1 that would balance the bridge. */
export function bridge({ va, r1, r2, r3, r4 }: Bridge) {
  if (![va, r1, r2, r3, r4].every(Number.isFinite) || [r1, r2, r3, r4].some(r => r <= 0)) return null;
  const vx = (va * r1) / (r1 + r4);
  const vy = (va * r2) / (r2 + r3);
  const vo = vx - vy;
  const r1Balance = (r4 * r2) / r3;
  // Relative tolerance so that rounding of the inputs does not hide a balanced bridge.
  const balanced = Math.abs(vo) <= Math.abs(va) * 1e-9;
  return { vx, vy, vo, ix: va / (r1 + r4), iy: va / (r2 + r3), left: r1 / r4, right: r2 / r3, r1Balance, balanced };
}

/** Quarter bridge of the slides: three equal resistors R and the sensor R + ΔR. Exact and small-change forms. */
export function quarterBridge(vs: number, r: number, dr: number) {
  const exact = (vs / 4) * (dr / (r + dr / 2));
  const approx = (vs / 4) * (dr / r);
  return { exact, approx, error: approx === 0 ? 0 : (approx - exact) / exact };
}
