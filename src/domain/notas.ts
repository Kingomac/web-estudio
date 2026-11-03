import type { GradeModality } from '../schemas/content.ts';

type GradeCounts = NonNullable<GradeModality['components'][number]['counts']>;
/** Rows matching some counts; a valid table has exactly one for every combination whose sum fits in the total. */
export const matchingRows = (counts: GradeCounts, values: Record<string, number>) =>
  counts.rows.filter(row => Object.entries(row.ranges).every(([category, [from, to]]) => values[category] >= from && values[category] <= to));

/** Mark from category counts: undefined until all are entered, 'invalid' if they are not whole numbers or exceed the total. */
export function markFromCounts(counts: GradeCounts, raw: Record<string, string>): number | undefined | 'invalid' {
  const values: Record<string, number> = {};
  for (const { id } of counts.categories) {
    const input = (raw[id] ?? '').trim();
    if (!input) return undefined;
    if (!/^\d+$/.test(input)) return 'invalid';
    values[id] = Number(input);
  }
  if (Object.values(values).reduce((sum, n) => sum + n, 0) > counts.total) return 'invalid';
  const [row] = matchingRows(counts, values);
  return row ? row.mark : 'invalid';
}

export type GradeInputs = Record<string, number | undefined>;
export interface GradeResult {
  /** Weighted points out of 10 from the components entered so far. */
  points: number;
  contributions: Record<string, number>;
  missing: string[];
  /** Components whose minimum is not reached. */
  failedMinimums: string[];
  /** Only when every component is entered. */
  final?: number;
  passed?: boolean;
  capped?: boolean;
  /** With exactly one component missing: the lowest mark that passes, or null if none does. */
  needed?: { componentId: string; value: number | null };
}

const EPSILON = 1e-9;

/** Reads a mark written with comma or point; rejects empty, malformed or out-of-range values. */
export function parseMark(raw: string, max: number): number | undefined | 'invalid' {
  const input = raw.trim();
  if (!input) return undefined;
  if (!/^\d+(?:[.,]\d+)?$/.test(input)) return 'invalid';
  const value = Number(input.replace(',', '.'));
  return Number.isFinite(value) && value <= max ? value : 'invalid';
}

export function computeGrade(modality: GradeModality, inputs: GradeInputs, passMark = 5): GradeResult {
  const contributions: Record<string, number> = {};
  const missing: string[] = [];
  const failedMinimums: string[] = [];
  let points = 0;
  for (const c of modality.components) {
    const value = inputs[c.id];
    if (value === undefined) { missing.push(c.id); continue; }
    contributions[c.id] = c.weight * value / c.max * 10;
    points += contributions[c.id];
    if (c.min !== undefined && value < c.min - EPSILON) failedMinimums.push(c.id);
  }
  const result: GradeResult = { points, contributions, missing, failedMinimums };
  if (!missing.length) {
    const reachesPass = points >= passMark - EPSILON;
    const capped = failedMinimums.length > 0 || (modality.cap.belowPassMark && !reachesPass);
    result.final = capped ? Math.min(points, modality.cap.value) : points;
    result.capped = capped && points > modality.cap.value;
    result.passed = !capped && reachesPass;
  } else if (missing.length === 1) {
    const component = modality.components.find(c => c.id === missing[0])!;
    const required = Math.max((passMark - points) / component.weight * component.max / 10, component.min ?? 0, 0);
    // Round up to hundredths so the shown mark always passes.
    const value = Math.ceil(required * 100 - EPSILON) / 100;
    result.needed = { componentId: component.id, value: failedMinimums.length || value > component.max + EPSILON ? null : value };
  }
  return result;
}

export const formatMark = (value: number) => value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
