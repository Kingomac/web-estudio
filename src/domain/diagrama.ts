// Pure calculations of radiation patterns with symmetry around the z axis (topic 6.2, pp. 18, 25 and 27).
// θ is measured from +z; the patterns do not depend on φ. Values are normalised power (maximum 1).

export type Pattern =
  | { kind: 'cosn'; n: number }
  | { kind: 'dipolo-corto' }
  | { kind: 'dipolo-media-onda' };

const deg = Math.PI / 180;

/** Normalised power pattern f(θ), with θ in radians. f(−θ) = f(θ): the other half of the cut. */
export function patternValue(p: Pattern, theta: number): number {
  const t = Math.abs(theta);
  if (p.kind === 'cosn') return Math.abs(Math.cos(t)) ** p.n;
  if (p.kind === 'dipolo-corto') return Math.sin(t) ** 2;
  const s = Math.sin(t);
  if (Math.abs(s) < 1e-9) return 0;
  return (Math.cos((Math.PI / 2) * Math.cos(t)) / s) ** 2;
}

/** Direction of the main lobe (θ, degrees) used to measure beam widths. */
export const mainDirection = (p: Pattern) => (p.kind === 'cosn' ? 0 : 90);

/** ∫₀^π f(θ) sen θ dθ by Simpson's rule. */
export function patternIntegral(p: Pattern, steps = 2000): number {
  const h = Math.PI / steps;
  let sum = 0;
  for (let i = 0; i <= steps; i++) {
    const w = i === 0 || i === steps ? 1 : i % 2 ? 4 : 2;
    sum += w * patternValue(p, i * h) * Math.sin(i * h);
  }
  return (sum * h) / 3;
}

/** Half-angle (degrees) from the main direction to the first point where f drops to `level`. */
function halfWidth(p: Pattern, level: number): number | null {
  const m = mainDirection(p) * deg;
  const step = 0.01 * deg;
  let prev = 0;
  for (let a = step; a <= Math.PI; a += step) {
    if (patternValue(p, m + a) <= level + 1e-12) {
      // Bisection between the previous sample and this one.
      let lo = prev, hi = a;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (patternValue(p, m + mid) > level + 1e-12) lo = mid; else hi = mid; }
      return hi / deg;
    }
    prev = a;
  }
  return null;
}

/** Directivity from the normalisation condition, beam widths and the directions of maxima and nulls. */
export function analyzePattern(p: Pattern) {
  if (p.kind === 'cosn' && (!Number.isInteger(p.n) || p.n < 2 || p.n % 2)) return null;
  const integral = patternIntegral(p);
  // d(θ) = K f(θ) and ∫∫ d sen θ dθ dφ = 4π → K · 2π · integral = 4π.
  const directivity = 2 / integral;
  const half = halfWidth(p, 0.5);
  const nul = halfWidth(p, 1e-9);
  return {
    integral,
    directivity,
    directivityDb: 10 * Math.log10(directivity),
    hpbw: half === null ? null : 2 * half,
    fnbw: nul === null ? null : 2 * nul,
    maxima: p.kind === 'cosn' ? [0, 180] : [90],
    nulls: p.kind === 'cosn' ? [90] : [0, 180],
  };
}
