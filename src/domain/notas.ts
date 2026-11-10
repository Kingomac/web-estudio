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
  /** Points out of 10 from the components entered so far. A geometric mean only means something once complete. */
  points: number;
  contributions: Record<string, number>;
  missing: string[];
  /** Components or joint minimums not reached. */
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
  const geometric = modality.aggregation === 'geometric';
  const scaled = (c: GradeModality['components'][number]) => inputs[c.id]! / c.max * 10;
  const members = (joint: GradeModality['jointMinimums'][number]) => modality.components.filter(c => joint.componentIds.includes(c.id));
  let points = geometric ? 1 : 0;
  for (const c of modality.components) {
    const value = inputs[c.id];
    if (value === undefined) { missing.push(c.id); continue; }
    contributions[c.id] = geometric ? scaled(c) ** c.weight : c.weight * scaled(c);
    points = geometric ? points * contributions[c.id] : points + contributions[c.id];
    if (c.min !== undefined && value < c.min - EPSILON) failedMinimums.push(c.id);
  }
  for (const joint of modality.jointMinimums) {
    const parts = members(joint);
    if (parts.some(c => inputs[c.id] === undefined)) continue;
    const average = parts.reduce((sum, c) => sum + c.weight * scaled(c), 0) / parts.reduce((sum, c) => sum + c.weight, 0);
    if (average < joint.min - EPSILON) failedMinimums.push(joint.id);
  }
  const result: GradeResult = { points, contributions, missing, failedMinimums };
  if (!missing.length) {
    const reachesPass = points >= passMark - EPSILON;
    const failed = failedMinimums.length > 0;
    const capped = (failed && (!modality.cap.onlyAbovePass || reachesPass)) || (modality.cap.belowPassMark && !reachesPass);
    const replacement = failed ? modality.components.find(c => c.id === modality.failedMinimumMark) : undefined;
    result.final = replacement ? scaled(replacement) : capped ? Math.min(points, modality.cap.value) : points;
    result.capped = !replacement && capped && points > modality.cap.value;
    result.passed = !capped && reachesPass;
  } else if (missing.length === 1) {
    const component = modality.components.find(c => c.id === missing[0])!;
    const toPass = geometric ? (points > 0 ? (passMark / points) ** (1 / component.weight) : Infinity) : (passMark - points) / component.weight;
    const jointFloors = modality.jointMinimums.filter(joint => joint.componentIds.includes(component.id)).map(joint => {
      const parts = members(joint);
      const others = parts.filter(c => c !== component).reduce((sum, c) => sum + c.weight * scaled(c), 0);
      return (joint.min * parts.reduce((sum, c) => sum + c.weight, 0) - others) / component.weight;
    });
    const required = Math.max(Math.max(toPass, ...jointFloors) * component.max / 10, component.min ?? 0, 0);
    // Round up to hundredths so the shown mark always passes.
    const value = Math.ceil(required * 100 - EPSILON) / 100;
    result.needed = { componentId: component.id, value: failedMinimums.length || value > component.max + EPSILON ? null : value };
  }
  return result;
}

export const formatMark = (value: number) => value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
